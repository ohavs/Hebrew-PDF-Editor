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

interface Run {
  x: number
  y: number
  width: number
  height: number
  baseline: number
  str: string
}

/** Every text run on a page, in display coordinates. */
async function pageRuns(pdfDoc: any, pageIndex: number): Promise<Run[]> {
  const page = await pdfDoc.getPage(pageIndex + 1)
  const rotation = ((page.rotate || 0) % 360 + 360) % 360
  const viewport = page.getViewport({ scale: 1, rotation })
  const content = await page.getTextContent()
  page.cleanup?.()

  const runs: Run[] = []
  for (const item of content.items as any[]) {
    if (!item.str) continue
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
  return runs
}

const isRtl = (s: string) => /[֐-׿؀-ۿ]/.test(s)

/**
 * The line of existing text under a point, ready to be replaced.
 *
 * A PDF line is often several separate runs, so they are gathered by baseline
 * and read back in the direction the text runs — otherwise a Hebrew line comes
 * back inside out. The rectangle spans the whole line, which is what the user
 * sees highlighted and what the replacement has to cover.
 */
export async function findEditableLineAt(
  pdfDoc: any,
  pageIndex: number,
  point: Point,
): Promise<EditableLine | null> {
  const runs = await pageRuns(pdfDoc, pageIndex)
  if (!runs.length) return null

  // The run under the pointer, with a little slack for thin lines
  const hit = runs.find(r =>
    point.x >= r.x - 2 && point.x <= r.x + r.width + 2 &&
    point.y >= r.y - 2 && point.y <= r.y + r.height + 2)
  if (!hit) return null

  const line = runs.filter(r => Math.abs(r.baseline - hit.baseline) <= BASELINE_TOLERANCE)
  const left = Math.min(...line.map(r => r.x))
  const right = Math.max(...line.map(r => r.x + r.width))
  const top = Math.min(...line.map(r => r.y))
  const bottom = Math.max(...line.map(r => r.y + r.height))

  const joined = line.map(r => r.str).join('')
  const rtl = isRtl(joined)
  // Visual order is left to right; a right-to-left line reads the other way
  const ordered = [...line].sort((a, b) => rtl ? b.x - a.x : a.x - b.x)

  return {
    rect: { x: left, y: top, width: right - left, height: bottom - top },
    text: ordered.map(r => r.str).join('').replace(/\s+/g, ' ').trim(),
    fontSize: Math.max(6, Math.round(hit.height * 0.78)),
    rtl,
  }
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
