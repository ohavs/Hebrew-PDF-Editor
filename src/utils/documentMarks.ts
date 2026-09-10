import { PDFDocument, PDFName, PDFArray, PDFDict, PDFRef, PDFString, PDFHexString } from 'pdf-lib'

/**
 * Marks that arrived inside the file: stamps, watermarks, notes and the like.
 *
 * These are annotations — objects attached to a page, not part of what the
 * page paints. Two things follow, and together they explain a complaint that
 * otherwise makes no sense ("the big DEMO VERSION turned white and I cannot
 * touch it"):
 *
 *  - An annotation with no appearance stream is drawn by nothing. pdf.js, like
 *    the PDF specification, paints only the appearance a file supplies; other
 *    editors invent one from the annotation's text. So the mark is plainly
 *    there in the file and plainly absent from the page.
 *  - Annotation text is not page text, so it never appears in getTextContent
 *    and the "edit existing text" tool cannot see a word of it.
 *
 * Removing them is a different operation from editing the page, which is why
 * it gets its own tool.
 */
export interface DocumentMark {
  /** Which page it hangs off, zero-based. */
  pageIndex: number
  /**
   * The PDF object this mark is, as "<number>R<generation>".
   *
   * Identity, not position. pdf.js quietly drops annotations it cannot parse,
   * so its list and the file's own array need not line up — addressing a mark
   * by its place in either one deletes whatever happens to sit there instead.
   */
  ref: string
  /** Stamp, Watermark, FreeText, Square… as the file declares it. */
  subtype: string
  /** The note's own text, when it carries any. */
  contents: string
  /** Whether the file supplies something to draw. Without it, nothing shows. */
  hasAppearance: boolean
  /** Rect in display coordinates: CSS px at zoom 1, origin top-left. */
  rect: { x: number; y: number; width: number; height: number }
}

/** Subtypes that are part of filling in a form rather than a mark on the page. */
const FORM_SUBTYPES = new Set(['Widget', 'Link', 'Popup'])

const HUMAN_SUBTYPE: Record<string, string> = {
  Stamp: 'חותמת',
  Watermark: 'סימן מים',
  FreeText: 'תיבת טקסט',
  Square: 'מלבן',
  Circle: 'עיגול',
  Line: 'קו',
  Polygon: 'מצולע',
  PolyLine: 'קו שבור',
  Highlight: 'הדגשה',
  Underline: 'קו תחתון',
  StrikeOut: 'קו חוצה',
  Squiggly: 'קו גלי',
  Text: 'הערה',
  Ink: 'ציור חופשי',
  FileAttachment: 'קובץ מצורף',
}

export const markLabel = (m: DocumentMark) => HUMAN_SUBTYPE[m.subtype] || m.subtype

/**
 * Every mark the document carries, page by page.
 *
 * Form fields and links are left out: they are machinery, not marks, and the
 * forms tool already owns them.
 */
export async function readMarks(pdfDoc: any): Promise<DocumentMark[]> {
  const marks: DocumentMark[] = []
  for (let pageIndex = 0; pageIndex < pdfDoc.numPages; pageIndex++) {
    const page = await pdfDoc.getPage(pageIndex + 1)
    const rotation = ((page.rotate || 0) % 360 + 360) % 360
    const viewport = page.getViewport({ scale: 1, rotation })
    let annots: any[] = []
    try {
      annots = await page.getAnnotations({ intent: 'display' })
    } catch {
      annots = [] // a damaged annotation list is not a reason to fail the scan
    }
    page.cleanup?.()

    for (const a of annots) {
      if (FORM_SUBTYPES.has(a.subtype)) continue
      // Without a reference there is no safe way to address it for removal
      if (typeof a.id !== 'string' || !/^\d+R\d*$/.test(a.id)) continue
      const [x0, y0, x1, y1] = viewport.convertToViewportRectangle(a.rect)
      marks.push({
        pageIndex,
        ref: a.id,
        subtype: a.subtype || 'Annot',
        contents: (a.contents || a.titleObj?.str || '').trim(),
        hasAppearance: Boolean(a.hasAppearance),
        rect: {
          x: Math.min(x0, x1),
          y: Math.min(y0, y1),
          width: Math.abs(x1 - x0),
          height: Math.abs(y1 - y0),
        },
      })
    }
  }
  return marks
}

/** "7R" / "7R2" as pdf.js writes it, back into object and generation numbers. */
function parseRef(ref: string): { num: number; gen: number } | null {
  const m = /^(\d+)R(\d*)$/.exec(ref)
  return m ? { num: Number(m[1]), gen: m[2] ? Number(m[2]) : 0 } : null
}

const refMatches = (entry: unknown, ref: string): boolean => {
  const want = parseRef(ref)
  return Boolean(
    want && entry instanceof PDFRef &&
    entry.objectNumber === want.num && entry.generationNumber === want.gen)
}

const readText = (v: any): string => {
  if (v instanceof PDFString || v instanceof PDFHexString) return v.decodeText()
  return ''
}

/**
 * The same list read straight from the file's own objects.
 *
 * pdf.js and pdf-lib each walk the annotation array in order, so an entry's
 * position identifies it in both — but only if both skip nothing. This reads
 * the raw array so that removal addresses exactly what the scan listed.
 */
function pageAnnots(doc: PDFDocument, pageIndex: number): PDFArray | null {
  const page = doc.getPage(pageIndex)
  const annots = page.node.lookup(PDFName.of('Annots'))
  return annots instanceof PDFArray ? annots : null
}

/**
 * A copy of the document without the given marks.
 *
 * Each mark is found by its object reference and dropped wherever it actually
 * sits, so a file whose annotation list pdf.js read only partly still loses
 * exactly the marks that were asked for. Entries go back to front, so removing
 * one does not renumber the ones still to go.
 */
export async function removeMarks(
  bytes: Uint8Array,
  marks: DocumentMark[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })

  const byPage = new Map<number, string[]>()
  for (const m of marks) {
    const list = byPage.get(m.pageIndex) || []
    list.push(m.ref)
    byPage.set(m.pageIndex, list)
  }

  for (const [pageIndex, refs] of byPage) {
    const annots = pageAnnots(doc, pageIndex)
    if (!annots) continue
    const wanted = new Set(refs)
    for (let i = annots.size() - 1; i >= 0; i--) {
      const entry = annots.get(i)
      if ([...wanted].some(ref => refMatches(entry, ref))) annots.remove(i)
    }
    if (annots.size() === 0) doc.getPage(pageIndex).node.delete(PDFName.of('Annots'))
  }

  return doc.save()
}

/**
 * Every mark in a document, read once.
 *
 * Scanning walks every page and then loads the file a second time with pdf-lib
 * to recover the text pdf.js omits — far too much to repeat for each page as
 * it scrolls into view, so the answer is kept for as long as the document is.
 */
const markCache = new WeakMap<object, Promise<DocumentMark[]>>()

export function marksOf(pdfDoc: any, bytes: Uint8Array | null): Promise<DocumentMark[]> {
  if (!pdfDoc) return Promise.resolve([])
  const cached = markCache.get(pdfDoc)
  if (cached) return cached
  const scan = (async () => {
    const found = await readMarks(pdfDoc)
    return bytes ? enrichContents(bytes, found) : found
  })().catch(() => [] as DocumentMark[])
  markCache.set(pdfDoc, scan)
  return scan
}

/**
 * What the raw file says about each mark, for the cases pdf.js glosses over.
 *
 * pdf.js reports no `contents` for some annotations that plainly carry text,
 * so the text shown in the list is taken from the file itself where possible.
 */
export async function enrichContents(
  bytes: Uint8Array,
  marks: DocumentMark[],
): Promise<DocumentMark[]> {
  let doc: PDFDocument
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  } catch {
    return marks
  }
  return marks.map(m => {
    if (m.contents) return m
    const annots = pageAnnots(doc, m.pageIndex)
    if (!annots) return m
    let dict: PDFDict | null = null
    for (let i = 0; i < annots.size(); i++) {
      if (refMatches(annots.get(i), m.ref)) {
        const looked = annots.lookup(i)
        if (looked instanceof PDFDict) dict = looked
        break
      }
    }
    if (!dict) return m
    const contents = readText(dict.get(PDFName.of('Contents')))
      || readText(dict.get(PDFName.of('T')))
    return contents ? { ...m, contents } : m
  })
}
