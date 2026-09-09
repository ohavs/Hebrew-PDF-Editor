import type { Rect, Point } from '../store/types'

export interface EditableLine {
  /** Display coordinates at zoom 1, matching the annotation convention. */
  rect: Rect
  text: string
  fontSize: number
  rtl: boolean
}

/** Two runs belong to the same line when their baselines are this close. */
const BASELINE_TOLERANCE = 3

/** Exported for tests: a single text run as pdf.js reports it, in display space. */
export interface Run {
  x: number
  y: number
  width: number
  height: number
  baseline: number
  str: string
}

/**
 * Every text run on a page, in display coordinates, alongside how many runs
 * the page actually painted. The two differ when a font ships without a
 * Unicode mapping: there is text on the page, but nothing readable comes back.
 */
async function pageRuns(pdfDoc: any, pageIndex: number): Promise<{ runs: Run[]; painted: number }> {
  const page = await pdfDoc.getPage(pageIndex + 1)
  const rotation = ((page.rotate || 0) % 360 + 360) % 360
  const viewport = page.getViewport({ scale: 1, rotation })
  const content = await page.getTextContent()
  page.cleanup?.()

  const runs: Run[] = []
  let painted = 0
  for (const item of content.items as any[]) {
    if (typeof item.str !== 'string') continue
    painted++
    if (!item.str.trim()) continue
    const tx = item.transform
    const fontH = Math.hypot(tx[1], tx[3]) || Math.hypot(tx[0], tx[2]) || 10
    const [vx0, vy0, vx1, vy1] = viewport.convertToViewportRectangle([
      tx[4], tx[5] - fontH * 0.25, tx[4] + (item.width || fontH), tx[5] + fontH,
    ])
    runs.push({
      x: Math.min(vx0, vx1),
      y: Math.min(vy0, vy1),
      width: Math.abs(vx1 - vx0),
      height: Math.abs(vy1 - vy0),
      baseline: Math.min(vy0, vy1) + Math.abs(vy1 - vy0),
      str: item.str,
    })
  }
  return { runs, painted }
}

const isRtl = (s: string) => /[֐-׿؀-ۿ]/.test(s)

export type LineHit =
  | { kind: 'line'; line: EditableLine }
  /** The page carries no text at all — a scan, or images only. */
  | { kind: 'no-text-layer' }
  /**
   * There is text on the page, but its font ships no Unicode mapping, so no
   * reader — this one included — can tell which letters were painted.
   */
  | { kind: 'unreadable-text' }
  | { kind: 'miss' }

/** How far above or below a line still counts as pointing at it. */
const VERTICAL_SLACK = 0.6
/** ...and how far past its ends, for the ragged edge of a paragraph. */
const HORIZONTAL_SLACK = 24

export interface Line {
  runs: Run[]
  rect: Rect
}

/**
 * A gap this many times the text height means the runs belong to different
 * blocks — two columns, or a label and its value — rather than to one line.
 */
const COLUMN_GAP = 2.5

function measure(runs: Run[]): Rect {
  const left = Math.min(...runs.map(r => r.x))
  const right = Math.max(...runs.map(r => r.x + r.width))
  const top = Math.min(...runs.map(r => r.y))
  const bottom = Math.max(...runs.map(r => r.y + r.height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

export function groupIntoLines(runs: Run[]): Line[] {
  // Runs sharing a baseline sit on the same line…
  const bands: Run[][] = []
  for (const run of [...runs].sort((a, b) => a.baseline - b.baseline)) {
    const last = bands[bands.length - 1]
    if (last && Math.abs(last[0].baseline - run.baseline) <= BASELINE_TOLERANCE) last.push(run)
    else bands.push([run])
  }

  // …unless a wide gap separates them, in which case a two-column page would
  // otherwise come back as one line stretching across both columns
  const lines: Line[] = []
  for (const band of bands) {
    const ordered = band.sort((a, b) => a.x - b.x)
    let chunk: Run[] = [ordered[0]]
    for (const run of ordered.slice(1)) {
      const prev = chunk[chunk.length - 1]
      const gap = run.x - (prev.x + prev.width)
      if (gap > Math.max(prev.height, run.height) * COLUMN_GAP) {
        lines.push({ runs: chunk, rect: measure(chunk) })
        chunk = [run]
      } else {
        chunk.push(run)
      }
    }
    lines.push({ runs: chunk, rect: measure(chunk) })
  }
  return lines
}

export function toEditable(line: Line): EditableLine {
  const joined = line.runs.map(r => r.str).join('')
  const rtl = isRtl(joined)
  // Visual order is left to right; a right-to-left line reads the other way
  const ordered = [...line.runs].sort((a, b) => rtl ? b.x - a.x : a.x - b.x)
  const tallest = line.runs.reduce((a, b) => (a.height > b.height ? a : b))

  // Runs often arrive without the spaces between them — the gap on the page is
  // the space. Anything wider than a sliver counts as one, in visual order,
  // which for a right-to-left line means looking at the run to the left.
  let text = ''
  ordered.forEach((r, i) => {
    if (i > 0) {
      const prev = ordered[i - 1]
      const gap = rtl ? prev.x - (r.x + r.width) : r.x - (prev.x + prev.width)
      if (gap > r.height * 0.15 && !/\s$/.test(text) && !/^\s/.test(r.str)) text += ' '
    }
    text += r.str
  })

  return {
    rect: line.rect,
    text: text.replace(/\s+/g, ' ').trim(),
    fontSize: Math.max(6, Math.round(tallest.height * 0.78)),
    rtl,
  }
}

/**
 * The line of existing text under a point, ready to be replaced.
 *
 * A PDF line is often several separate runs, so they are gathered by baseline
 * and read back in the direction the text runs — otherwise a Hebrew line comes
 * back inside out. Pointing is forgiving: a line's own box is only about one
 * font size tall, which at a phone's zoom is a handful of pixels, so a point
 * near a line still picks it.
 */
export async function findEditableLineAt(
  pdfDoc: any,
  pageIndex: number,
  point: Point,
): Promise<LineHit> {
  const { runs, painted } = await pageRuns(pdfDoc, pageIndex)
  if (!runs.length) return { kind: painted ? 'unreadable-text' : 'no-text-layer' }

  const lines = groupIntoLines(runs)
  const inside = lines.find(l =>
    point.x >= l.rect.x - 2 && point.x <= l.rect.x + l.rect.width + 2 &&
    point.y >= l.rect.y - 2 && point.y <= l.rect.y + l.rect.height + 2)
  if (inside) return { kind: 'line', line: toEditable(inside) }

  // Nothing directly under the pointer: take the nearest line that is close
  // enough to have been aimed at
  let best: Line | null = null
  let bestDistance = Infinity
  for (const l of lines) {
    const slack = l.rect.height * VERTICAL_SLACK
    const withinBand = point.y >= l.rect.y - slack && point.y <= l.rect.y + l.rect.height + slack
    const withinSpan = point.x >= l.rect.x - HORIZONTAL_SLACK &&
      point.x <= l.rect.x + l.rect.width + HORIZONTAL_SLACK
    if (!withinBand || !withinSpan) continue
    const dy = Math.abs(point.y - (l.rect.y + l.rect.height / 2))
    if (dy < bestDistance) { bestDistance = dy; best = l }
  }
  return best ? { kind: 'line', line: toEditable(best) } : { kind: 'miss' }
}

/**
 * Text and background colours read from the rendered page.
 *
 * getTextContent carries no colour, so the pixels are the only source: the
 * darkest pixel inside the line is the ink, and the most common one along the
 * margin just outside it is the paper.
 */
export function sampleLineColors(
  canvas: HTMLCanvasElement,
  rect: Rect,
  naturalWidth: number,
): { text: string; background: string } {
  const fallback = { text: '#111111', background: '#ffffff' }
  if (!canvas.width || !naturalWidth) return fallback
  const scale = canvas.width / naturalWidth
  const x = Math.max(0, Math.floor(rect.x * scale))
  const y = Math.max(0, Math.floor(rect.y * scale))
  const w = Math.min(canvas.width - x, Math.ceil(rect.width * scale))
  const h = Math.min(canvas.height - y, Math.ceil(rect.height * scale))
  if (w <= 0 || h <= 0) return fallback

  let data: Uint8ClampedArray
  try {
    data = canvas.getContext('2d')!.getImageData(x, y, w, h).data
  } catch {
    return fallback // a tainted canvas is not worth failing the edit over
  }

  const hex = (r: number, g: number, b: number) =>
    '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')

  let darkest: [number, number, number] = [255, 255, 255]
  let darkestSum = 766
  const counts = new Map<string, number>()

  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
    const sum = r + g + b
    if (sum < darkestSum) { darkestSum = sum; darkest = [r, g, b] }
    // Quantised so near-identical paper shades count as one
    const key = `${r >> 4},${g >> 4},${b >> 4}`
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  let bestKey = ''
  let bestCount = 0
  counts.forEach((c, k) => { if (c > bestCount) { bestCount = c; bestKey = k } })
  const [br, bg, bb] = bestKey.split(',').map(n => (parseInt(n) << 4) + 8)

  return {
    text: hex(darkest[0], darkest[1], darkest[2]),
    background: hex(br, bg, bb),
  }
}
