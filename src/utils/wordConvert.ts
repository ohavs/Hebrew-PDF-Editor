// PDF ⇄ Word (docx) conversion, fully client-side.
// Text-level fidelity: paragraphs and page breaks survive; complex layout,
// images and tables do not — same trade-off as most free online converters.
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate'

export interface DocParagraph {
  text: string
  rtl: boolean
}

const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// ─── PDF → DOCX ───────────────────────────────────────────────────────────────

/** Extract text lines from every page of a pdf.js document. */
export async function extractParagraphs(pdfDoc: any): Promise<DocParagraph[][]> {
  const pages: DocParagraph[][] = []
  for (let p = 1; p <= pdfDoc.numPages; p++) {
    const page = await pdfDoc.getPage(p)
    const content = await page.getTextContent()
    // Group items into lines by their y position
    const lines = new Map<number, { x: number; str: string }[]>()
    for (const item of content.items as any[]) {
      if (!item.str) continue
      const y = Math.round(item.transform[5] / 4) * 4 // 4pt tolerance
      if (!lines.has(y)) lines.set(y, [])
      lines.get(y)!.push({ x: item.transform[4], str: item.str })
    }
    const sorted = [...lines.entries()]
      .sort((a, b) => b[0] - a[0]) // top (high y) first
      .map(([, items]) => items.sort((a, b) => a.x - b.x).map(i => i.str).join(' ').trim())
      .filter(Boolean)
    pages.push(sorted.map(text => ({ text, rtl: /[֐-׿]/.test(text) })))
    page.cleanup?.()
  }
  return pages
}

/** Build a minimal valid .docx from per-page paragraph lists. */
export function buildDocx(pages: DocParagraph[][]): Uint8Array {
  const paragraphsXml = pages.map((paras, pi) => {
    const body = paras.map(p => {
      const dir = p.rtl ? '<w:bidi/>' : ''
      const rtlRun = p.rtl ? '<w:rtl/>' : ''
      return `<w:p><w:pPr>${dir}</w:pPr><w:r><w:rPr>${rtlRun}<w:rFonts w:ascii="Arial" w:cs="Arial" w:hAnsi="Arial"/></w:rPr><w:t xml:space="preserve">${xmlEscape(p.text)}</w:t></w:r></w:p>`
    }).join('')
    const pageBreak = pi < pages.length - 1
      ? '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
      : ''
    return body + pageBreak
  }).join('')

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${paragraphsXml}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body>
</w:document>`

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

  return zipSync({
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(rels),
    'word/document.xml': strToU8(documentXml),
  })
}

// ─── DOCX → paragraphs ────────────────────────────────────────────────────────

/** Parse a .docx file into a flat list of paragraphs (page breaks → markers). */
export function parseDocx(bytes: Uint8Array): DocParagraph[] {
  const files = unzipSync(bytes)
  const doc = files['word/document.xml']
  if (!doc) throw new Error('not a docx')
  const xml = new DOMParser().parseFromString(strFromU8(doc), 'application/xml')
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
  const out: DocParagraph[] = []
  const paragraphs = xml.getElementsByTagNameNS(W, 'p')
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i]
    const texts = p.getElementsByTagNameNS(W, 't')
    let text = ''
    for (let j = 0; j < texts.length; j++) text += texts[j].textContent || ''
    const breaks = p.getElementsByTagNameNS(W, 'br')
    let hasPageBreak = false
    for (let j = 0; j < breaks.length; j++) {
      if (breaks[j].getAttributeNS(W, 'type') === 'page' || breaks[j].getAttribute('w:type') === 'page') hasPageBreak = true
    }
    out.push({ text, rtl: /[֐-׿]/.test(text) })
    if (hasPageBreak) out.push({ text: '\f', rtl: false }) // page-break marker
  }
  return out
}

// ─── Paragraphs → PDF (rasterized pages, Hebrew-safe) ────────────────────────

const PAGE_W = 595, PAGE_H = 842 // A4 points
const MARGIN = 56
const FONT_SIZE = 12
const LINE_H = FONT_SIZE * 1.6
const SCALE = 3

/** Render paragraphs onto A4-sized canvases (returns PNG data URLs). */
export function renderParagraphsToPages(paras: DocParagraph[]): string[] {
  const pages: string[] = []
  let canvas = newPage()
  let ctx = canvas.getContext('2d')!
  let y = MARGIN

  const flush = () => {
    pages.push(canvas.toDataURL('image/png'))
    canvas = newPage()
    ctx = canvas.getContext('2d')!
    y = MARGIN
  }

  function newPage(): HTMLCanvasElement {
    const c = document.createElement('canvas')
    c.width = PAGE_W * SCALE
    c.height = PAGE_H * SCALE
    const cx = c.getContext('2d')!
    cx.fillStyle = '#ffffff'
    cx.fillRect(0, 0, c.width, c.height)
    return c
  }

  const setFont = () => {
    ctx.font = `${FONT_SIZE * SCALE}px 'Heebo', Arial, sans-serif`
    ctx.fillStyle = '#111'
    ctx.textBaseline = 'alphabetic'
  }

  for (const para of paras) {
    if (para.text === '\f') { flush(); continue }
    if (!para.text.trim()) { y += LINE_H * 0.6; continue }
    setFont()
    ctx.direction = para.rtl ? 'rtl' : 'ltr'
    ctx.textAlign = para.rtl ? 'right' : 'left'
    const anchorX = (para.rtl ? PAGE_W - MARGIN : MARGIN) * SCALE
    const maxWidth = (PAGE_W - MARGIN * 2) * SCALE

    // word-wrap
    const words = para.text.split(/\s+/)
    let line = ''
    const lines: string[] = []
    for (const word of words) {
      const probe = line ? `${line} ${word}` : word
      if (ctx.measureText(probe).width > maxWidth && line) { lines.push(line); line = word }
      else line = probe
    }
    if (line) lines.push(line)

    for (const l of lines) {
      if (y + LINE_H > PAGE_H - MARGIN) flush()
      setFont()
      ctx.direction = para.rtl ? 'rtl' : 'ltr'
      ctx.textAlign = para.rtl ? 'right' : 'left'
      ctx.fillText(l, anchorX, (y + FONT_SIZE) * SCALE)
      y += LINE_H
    }
    y += LINE_H * 0.35 // paragraph spacing
  }

  pages.push(canvas.toDataURL('image/png'))
  return pages
}
