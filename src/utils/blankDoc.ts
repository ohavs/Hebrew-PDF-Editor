// Blank documents for the authoring area.
//
// Everything downstream — the viewer, every tool, the exporter — already works
// on "a PDF plus a layer of objects". So creating from scratch is a matter of
// producing real blank pages; the rest of the app then applies unchanged.
import { PDFDocument, rgb } from 'pdf-lib'

export interface PagePreset {
  id: string
  label: string
  /** Portrait dimensions in PDF points (72 per inch). */
  width: number
  height: number
}

export const PAGE_PRESETS: PagePreset[] = [
  { id: 'a4',      label: 'A4',            width: 595.28, height: 841.89 },
  { id: 'letter',  label: 'Letter',        width: 612,    height: 792 },
  { id: 'legal',   label: 'Legal',         width: 612,    height: 1008 },
  { id: 'a5',      label: 'A5',            width: 419.53, height: 595.28 },
  { id: 'a3',      label: 'A3',            width: 841.89, height: 1190.55 },
  { id: 'tabloid', label: 'Tabloid',       width: 792,    height: 1224 },
  { id: 'square',  label: 'ריבוע',          width: 595.28, height: 595.28 },
]

export const MM_PER_POINT = 25.4 / 72
export const mmToPoints = (mm: number) => mm / MM_PER_POINT
export const pointsToMm = (pt: number) => pt * MM_PER_POINT

export interface BlankDocSpec {
  width: number
  height: number
  count: number
  /** Hex colour. White is left as a plain page rather than a painted one. */
  background?: string
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean
  return [
    parseInt(full.slice(0, 2), 16) / 255,
    parseInt(full.slice(2, 4), 16) / 255,
    parseInt(full.slice(4, 6), 16) / 255,
  ]
}

/** White needs no painted rectangle — a PDF page is already white. */
function isWhite(hex?: string): boolean {
  if (!hex) return true
  const c = hex.replace('#', '').toLowerCase()
  return c === 'fff' || c === 'ffffff'
}

/** A real, valid PDF of blank pages — the starting point for authoring. */
export async function createBlankPdf(spec: BlankDocSpec): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const count = Math.max(1, Math.min(200, Math.round(spec.count)))
  for (let i = 0; i < count; i++) {
    const page = doc.addPage([spec.width, spec.height])
    if (spec.background && !isWhite(spec.background)) {
      const [r, g, b] = hexToRgb(spec.background)
      page.drawRectangle({ x: 0, y: 0, width: spec.width, height: spec.height, color: rgb(r, g, b) })
    }
  }
  return doc.save()
}

/** Append blank pages matching an existing page's size. */
export async function appendBlankPages(
  bytes: Uint8Array,
  count: number,
  size?: [number, number],
  background?: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes)
  const last = doc.getPageCount() ? doc.getPage(doc.getPageCount() - 1) : null
  const [w, h] = size ?? (last ? [last.getWidth(), last.getHeight()] : [595.28, 841.89])
  for (let i = 0; i < Math.max(1, count); i++) {
    const page = doc.addPage([w, h])
    if (background && !isWhite(background)) {
      const [r, g, b] = hexToRgb(background)
      page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: rgb(r, g, b) })
    }
  }
  return doc.save()
}
