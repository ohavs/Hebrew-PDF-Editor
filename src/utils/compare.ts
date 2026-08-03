// Comparing two revisions of the same document, fully client-side.
//
// Two passes, because they catch different things: a text diff says exactly
// which lines were rewritten, and a pixel pass catches everything the text
// layer cannot see — moved blocks, swapped images, changed stamps.

export interface PageTextDiff {
  pageIndex: number
  added: string[]
  removed: string[]
}

export interface ChangedRegion {
  /** Display coordinates (origin top-left) at scale 1, like annotations. */
  x: number
  y: number
  width: number
  height: number
}

export interface PageDiff extends PageTextDiff {
  regions: ChangedRegion[]
  /** Neither side has this page — it was added or dropped entirely. */
  onlyIn: 'a' | 'b' | null
}

/** Text lines per page, ordered top to bottom. */
export async function extractLines(pdfDoc: any): Promise<string[][]> {
  const pages: string[][] = []
  for (let p = 1; p <= pdfDoc.numPages; p++) {
    const page = await pdfDoc.getPage(p)
    const content = await page.getTextContent()
    const lines = new Map<number, { x: number; str: string }[]>()
    for (const item of content.items as any[]) {
      if (!item.str?.trim()) continue
      const y = Math.round(item.transform[5] / 4) * 4
      if (!lines.has(y)) lines.set(y, [])
      lines.get(y)!.push({ x: item.transform[4], str: item.str })
    }
    page.cleanup?.()
    pages.push([...lines.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, items]) => items.sort((a, b) => a.x - b.x).map(i => i.str).join(' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean))
  }
  return pages
}

/**
 * Which lines are only in one side. An LCS keeps the common run in order, so
 * a paragraph inserted at the top does not report every line below it as
 * changed — which a naive set difference would.
 */
export function diffLines(a: string[], b: string[]): { added: string[]; removed: string[] } {
  const n = a.length
  const m = b.length
  // lcs[i][j] = length of the longest common subsequence of a[i:] and b[j:]
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const added: string[] = []
  const removed: string[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) { i++; j++ }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) removed.push(a[i++])
    else added.push(b[j++])
  }
  while (i < n) removed.push(a[i++])
  while (j < m) added.push(b[j++])
  return { added, removed }
}

/**
 * Rectangles where two renderings of the same page differ.
 *
 * The page is walked as a coarse grid rather than pixel by pixel: a cell
 * counts as changed when enough of its pixels moved, which ignores the
 * one-pixel antialiasing noise that two independent renders always produce,
 * and neighbouring changed cells are merged into readable boxes.
 */
export function diffCanvases(
  a: HTMLCanvasElement,
  b: HTMLCanvasElement,
  displayWidth: number,
  displayHeight: number,
): ChangedRegion[] {
  const w = Math.min(a.width, b.width)
  const h = Math.min(a.height, b.height)
  if (w === 0 || h === 0) return []

  const da = a.getContext('2d')!.getImageData(0, 0, w, h).data
  const db = b.getContext('2d')!.getImageData(0, 0, w, h).data

  const CELL = 8               // px of the rendered bitmap
  const PIXEL_TOLERANCE = 40   // per-channel; below this is antialiasing
  const CELL_THRESHOLD = 0.02  // fraction of a cell's pixels that must move

  const cols = Math.ceil(w / CELL)
  const rows = Math.ceil(h / CELL)
  const changed = new Uint8Array(cols * rows)

  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const x0 = cx * CELL
      const y0 = cy * CELL
      const x1 = Math.min(x0 + CELL, w)
      const y1 = Math.min(y0 + CELL, h)
      let moved = 0
      let total = 0
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * w + x) * 4
          total++
          if (Math.abs(da[i] - db[i]) > PIXEL_TOLERANCE ||
              Math.abs(da[i + 1] - db[i + 1]) > PIXEL_TOLERANCE ||
              Math.abs(da[i + 2] - db[i + 2]) > PIXEL_TOLERANCE) moved++
        }
      }
      if (total && moved / total > CELL_THRESHOLD) changed[cy * cols + cx] = 1
    }
  }

  // Flood-fill neighbouring changed cells into rectangles
  const regions: ChangedRegion[] = []
  const seen = new Uint8Array(changed.length)
  const scaleX = displayWidth / w
  const scaleY = displayHeight / h

  for (let start = 0; start < changed.length; start++) {
    if (!changed[start] || seen[start]) continue
    const stack = [start]
    seen[start] = 1
    let minX = cols, maxX = -1, minY = rows, maxY = -1
    while (stack.length) {
      const idx = stack.pop()!
      const cx = idx % cols
      const cy = Math.floor(idx / cols)
      if (cx < minX) minX = cx
      if (cx > maxX) maxX = cx
      if (cy < minY) minY = cy
      if (cy > maxY) maxY = cy
      // 8-connected, so a diagonal step across a gap still joins one region
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx
          const ny = cy + dy
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
          const ni = ny * cols + nx
          if (changed[ni] && !seen[ni]) { seen[ni] = 1; stack.push(ni) }
        }
      }
    }
    regions.push({
      x: minX * CELL * scaleX,
      y: minY * CELL * scaleY,
      width: (maxX - minX + 1) * CELL * scaleX,
      height: (maxY - minY + 1) * CELL * scaleY,
    })
  }

  // Tiny specks are render noise, not edits
  return regions.filter(r => r.width * r.height > 24)
}
