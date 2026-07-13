import type { Rect } from '../store/types'

export interface SearchMatch {
  pageIndex: number
  /** Natural (scale-1 display) coordinates, same space as annotations */
  rect: Rect
  snippet: string
}

/**
 * Full-document text search via pdf.js getTextContent.
 * Matches are highlighted at text-item granularity — precise enough to
 * see where the hit is, cheap enough to run on a phone.
 */
export async function searchDocument(pdfDoc: any, query: string, signal?: { cancelled: boolean }): Promise<SearchMatch[]> {
  const q = query.trim().toLowerCase()
  if (!q || !pdfDoc) return []
  const matches: SearchMatch[] = []

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    if (signal?.cancelled) return matches
    try {
      const page = await pdfDoc.getPage(pageNum)
      const rotation = ((page.rotate || 0) % 360 + 360) % 360
      const viewport = page.getViewport({ scale: 1, rotation })
      const content = await page.getTextContent()

      for (const item of content.items as any[]) {
        const str: string = item.str || ''
        if (!str.toLowerCase().includes(q)) continue

        // item.transform = [a, b, c, d, e, f]; (e, f) is the baseline origin
        // in PDF user space. Convert the item's box to viewport (display) space.
        const tx = item.transform
        const fontH = Math.hypot(tx[1], tx[3]) || Math.hypot(tx[0], tx[2]) || 10
        const x0 = tx[4]
        const y0 = tx[5] - fontH * 0.25 // include descender
        const x1 = tx[4] + (item.width || fontH)
        const y1 = tx[5] + fontH
        const [vx0, vy0, vx1, vy1] = viewport.convertToViewportRectangle([x0, y0, x1, y1])

        matches.push({
          pageIndex: pageNum - 1,
          rect: {
            x: Math.min(vx0, vx1),
            y: Math.min(vy0, vy1),
            width: Math.abs(vx1 - vx0),
            height: Math.abs(vy1 - vy0),
          },
          snippet: str.length > 60 ? str.slice(0, 60) + '…' : str,
        })
      }
      page.cleanup?.()
    } catch { /* skip unreadable pages */ }
  }
  return matches
}
