import * as pdfjsLib from 'pdfjs-dist'

/**
 * What a page is actually made of.
 *
 * "I can see it but I cannot edit it" has several unrelated causes that look
 * identical on screen — a scan, a font with no Unicode mapping, a stamp that
 * is not page content, text painted in a colour that only shows against what
 * is behind it. Guessing between them wastes everyone's time, so this reports
 * what the page really contains and lets the answer be read off.
 */
export interface PageReport {
  pageIndex: number
  /** Text-showing operations on the page. */
  textRuns: number
  /** How many of those yield letters a reader could recognise. */
  readableRuns: number
  images: number
  annotations: number
  /** Fill colours used to paint text, busiest first. */
  textColors: { color: string; runs: number }[]
  /** Text painted white or near enough — invisible on white paper. */
  whiteTextRuns: number
  /** Blend modes other than the default, which change how paint lands. */
  blendModes: string[]
  fonts: string[]
}

const OPS = (pdfjsLib as any).OPS

/** Distance from pure white below which text vanishes into the paper. */
const WHITE_CUTOFF = 0.94

function brightness(color: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(color)
  if (!m) return 0
  const n = parseInt(m[1], 16)
  // Perceived brightness; a light grey hides on white almost as well as white
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
}

const hexFromGray = (g: number) => {
  const v = Math.max(0, Math.min(255, Math.round(g * 255)))
  return '#' + v.toString(16).padStart(2, '0').repeat(3)
}

const hexFromCmyk = (c: number, m: number, y: number, k: number) => {
  const ch = (x: number) => Math.round(255 * (1 - Math.min(1, x + k)))
  return '#' + [ch(c), ch(m), ch(y)]
    .map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')
}

export async function describePage(pdfDoc: any, pageIndex: number): Promise<PageReport> {
  const page = await pdfDoc.getPage(pageIndex + 1)
  const [ops, content, annots] = await Promise.all([
    page.getOperatorList(),
    page.getTextContent(),
    page.getAnnotations({ intent: 'display' }).catch(() => []),
  ])

  const runsByColor = new Map<string, number>()
  const blendModes = new Set<string>()
  let images = 0
  let textRuns = 0
  let whiteTextRuns = 0
  let fill = '#000000'

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i]
    const args = ops.argsArray[i]
    switch (fn) {
      case OPS.setFillRGBColor:
        if (typeof args?.[0] === 'string') fill = args[0].toLowerCase()
        break
      case OPS.setFillGray:
        if (typeof args?.[0] === 'number') fill = hexFromGray(args[0])
        break
      case OPS.setFillCMYKColor:
        if (args?.length >= 4) fill = hexFromCmyk(args[0], args[1], args[2], args[3])
        break
      case OPS.setGState:
        for (const [key, value] of (args?.[0] || [])) {
          if (key === 'BM' && value && value !== 'Normal' && value !== 'Compatible') {
            blendModes.add(String(value))
          }
        }
        break
      case OPS.showText:
      case OPS.showSpacedText:
        textRuns++
        runsByColor.set(fill, (runsByColor.get(fill) || 0) + 1)
        if (brightness(fill) >= WHITE_CUTOFF) whiteTextRuns++
        break
      case OPS.paintImageXObject:
      case OPS.paintJpegXObject:
      case OPS.paintInlineImageXObject:
      case OPS.paintImageMaskXObject:
        images++
        break
    }
  }

  const readableRuns = (content.items as any[])
    .filter(i => typeof i.str === 'string' && i.str.trim().length > 0).length
  const fonts = Array.from(new Set(
    Object.values(content.styles || {}).map((s: any) => s?.fontFamily).filter(Boolean)))

  page.cleanup?.()

  return {
    pageIndex,
    textRuns,
    readableRuns,
    images,
    annotations: annots.length,
    textColors: [...runsByColor.entries()]
      .map(([color, runs]) => ({ color, runs }))
      .sort((a, b) => b.runs - a.runs),
    whiteTextRuns,
    blendModes: [...blendModes],
    fonts: fonts as string[],
  }
}

/**
 * The report in plain Hebrew, as a short list of findings.
 *
 * Only what bears on "why can I not edit this" is said; a page that is simply
 * ordinary gets one line saying so.
 */
export function explainPage(r: PageReport): string[] {
  const lines: string[] = []

  if (r.whiteTextRuns > 0) {
    lines.push(`יש בדף ${r.whiteTextRuns} קטעי טקסט הצבועים בלבן או כמעט־לבן. על נייר לבן הם לא נראים — כך נראה כיתוב ש"נעלם".`)
  }
  if (r.blendModes.length) {
    lines.push(`הדף משתמש במצבי מיזוג (${r.blendModes.join(', ')}). כיתוב כזה יכול להיראות שונה מאוד בין תוכנות.`)
  }
  if (r.textRuns > 0 && r.readableRuns === 0) {
    lines.push('יש בדף טקסט, אך הגופן לא מספק מיפוי לאותיות, ולכן אי אפשר לקרוא או לערוך אותו.')
  }
  if (r.textRuns === 0 && r.images > 0) {
    lines.push('הדף כולו תמונה — אין בו טקסט כלל. כדי לערוך צריך OCR, שעדיין לא קיים כאן.')
  }
  if (r.annotations > 0) {
    lines.push(`הדף נושא ${r.annotations} סימנים שאינם חלק מתוכן העמוד. אפשר להסיר אותם כאן.`)
  }
  if (!lines.length) {
    lines.push(`הדף רגיל: ${r.readableRuns} קטעי טקסט קריאים${r.images ? `, ${r.images} תמונות` : ''}.`)
  }
  return lines
}

export type TextStatus =
  /** Words can be found and edited. */
  | 'has-text'
  /** Pages paint pictures only — a scan, or a flipbook converted to PDF. */
  | 'no-text'
  /** Glyphs are painted, but their font says nothing about which letters. */
  | 'unreadable'

const statusCache = new WeakMap<object, Promise<TextStatus>>()

/**
 * Whether the document holds text a reader could search.
 *
 * Answering "why did search find nothing" needs the difference between a word
 * that is not there and a document that has no words at all. A handful of
 * pages settle it, so a long document is not walked end to end.
 */
export function documentTextStatus(pdfDoc: any, sample = 5): Promise<TextStatus> {
  if (!pdfDoc) return Promise.resolve('no-text')
  const cached = statusCache.get(pdfDoc)
  if (cached) return cached

  const scan = (async (): Promise<TextStatus> => {
    const pages = Math.min(sample, pdfDoc.numPages)
    let anyRuns = false
    for (let i = 0; i < pages; i++) {
      const page = await pdfDoc.getPage(i + 1)
      const content = await page.getTextContent()
      page.cleanup?.()
      const items = content.items as any[]
      if (items.some(it => typeof it.str === 'string' && it.str.trim())) return 'has-text'
      if (items.length) anyRuns = true
    }
    return anyRuns ? 'unreadable' : 'no-text'
  })().catch(() => 'has-text' as TextStatus) // never block search on a failed probe

  statusCache.set(pdfDoc, scan)
  return scan
}

/** Why a search over this document can find nothing, in plain Hebrew. */
export function explainEmptySearch(status: TextStatus): string | null {
  if (status === 'no-text') {
    return 'בקובץ הזה אין שכבת טקסט כלל — העמודים הם תמונות (סריקה, או המרה מפליפבוק). חיפוש ועריכת טקסט דורשים OCR, שעדיין לא קיים כאן.'
  }
  if (status === 'unreadable') {
    return 'יש בקובץ טקסט, אך הגופנים שבהם הוא נכתב לא כוללים מיפוי לאותיות, ולכן אי אפשר לחפש בו.'
  }
  return null
}
