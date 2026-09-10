import { PDFDocument, PDFName, PDFString, StandardFonts, rgb } from 'pdf-lib'
import { zipSync, strToU8 } from 'fflate'
import type { Page } from '@playwright/test'

/** A PDF with `pages` pages, each stamped "PAGE n" in large type. */
export async function makePdf(pages = 3): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let p = 1; p <= pages; p++) {
    const page = doc.addPage([595, 842])
    page.drawText(`PAGE ${p}`, { x: 180, y: 420, size: 56, font })
  }
  return Buffer.from(await doc.save())
}

/**
 * A PDF carrying a big "DEMO VERSION" stamp as an annotation with no
 * appearance stream — the shape of a trial-software watermark. Nothing paints
 * it, and its words are not page text, so it is invisible to both the canvas
 * and getTextContent.
 */
export async function makeStampedPdf(
  pages = 2,
  text = 'DEMO VERSION',
  opts: { leadingLink?: boolean } = {},
): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let p = 1; p <= pages; p++) {
    const page = doc.addPage([595, 842])
    page.drawText(`REAL TEXT ${p}`, { x: 60, y: 120, size: 18, font })
    const stamp = doc.context.register(doc.context.obj({
      Type: 'Annot', Subtype: 'FreeText',
      Rect: [100, 500, 500, 570],
      Contents: PDFString.of(text),
      DA: PDFString.of('/Helv 44 Tf 0 g'),
      F: 4,
    }))
    const note = doc.context.register(doc.context.obj({
      Type: 'Annot', Subtype: 'Text',
      Rect: [40, 700, 60, 720],
      Contents: PDFString.of('keep me'),
      F: 4,
    }))
    // A link ahead of the stamp makes the tool's list and the file's own array
    // disagree about position — the case that positional removal gets wrong
    const link = doc.context.register(doc.context.obj({
      Type: 'Annot', Subtype: 'Link', Rect: [40, 60, 200, 80], F: 4,
    }))
    page.node.set(PDFName.of('Annots'), doc.context.obj(
      opts.leadingLink ? [link, stamp, note] : [stamp, note]))
  }
  return Buffer.from(await doc.save())
}

/** A one-page PDF carrying a real AcroForm: a text field and a checkbox. */
export async function makeFormPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const page = doc.addPage([595, 842])
  page.drawText('FORM', { x: 60, y: 780, size: 24, font })

  const form = doc.getForm()
  const name = form.createTextField('applicant.name')
  name.addToPage(page, { x: 60, y: 700, width: 300, height: 26 })
  const agree = form.createCheckBox('applicant.agree')
  agree.addToPage(page, { x: 60, y: 650, width: 20, height: 20 })

  return Buffer.from(await doc.save())
}

/** A PDF whose pages carry the given lines — for diffing two revisions. */
export async function makeTextPdf(pages: string[][]): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (const lines of pages) {
    const page = doc.addPage([595, 842])
    lines.forEach((line, i) => {
      page.drawText(line, { x: 60, y: 760 - i * 28, size: 14, font })
    })
  }
  return Buffer.from(await doc.save())
}

/** A one-page PDF laying text out as a 3-column grid. */
export async function makeTablePdf(rows: string[][]): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const page = doc.addPage([595, 842])
  const xs = [60, 240, 420]
  rows.forEach((row, r) => {
    row.forEach((cell, c) => {
      page.drawText(cell, { x: xs[c], y: 760 - r * 30, size: 12, font })
    })
  })
  return Buffer.from(await doc.save())
}

/**
 * A PDF whose pages are solid, distinct colours — so a thumbnail can be
 * identified by sampling it, which is how a stale preview gets caught.
 */
export async function makeColoredPdf(colors: Array<[number, number, number]>): Promise<Buffer> {
  const doc = await PDFDocument.create()
  for (const [r, g, b] of colors) {
    const page = doc.addPage([595, 842])
    page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(r / 255, g / 255, b / 255) })
  }
  return Buffer.from(await doc.save())
}

/** A minimal but valid .docx containing the given paragraphs. */
export function makeDocx(paragraphs: string[]): Buffer {
  const body = paragraphs
    .map(t => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`)
    .join('')
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>`

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

  return Buffer.from(zipSync({
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(rels),
    'word/document.xml': strToU8(documentXml),
  }))
}

/**
 * A 64x64 solid PNG as a data URL. Deliberately not a few pixels wide:
 * Playwright cannot settle boundingBox() on a 4px element.
 */
export const RED_SQUARE_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAYklEQVR4nO3PMQ0AIADAMEAM/gUhBhEcDcmqYJtn7/GzpQNeNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaBdDKIBqK+eVxEAAAAASUVORK5CYII='

/**
 * Upload a generated file into the page's document picker.
 *
 * Not simply the first file input: the editor also carries a hidden
 * image picker for the picture tool, and dropping a PDF into that one
 * silently does nothing.
 */
export async function upload(page: Page, name: string, buffer: Buffer, mimeType: string, selector?: string) {
  if (selector) {
    await page.locator(selector).first().setInputFiles({ name, mimeType, buffer })
    return
  }
  const pdfInput = page.locator('input[type="file"][accept*="pdf"]')
  const target = await pdfInput.count() ? pdfInput : page.locator('input[type="file"]:not([accept*="image"])')
  await target.first().setInputFiles({ name, mimeType, buffer })
}

/** Open a document in the given tool of the quick-tools hub. */
export async function openToolWithPdf(page: Page, tool: string, pages = 3) {
  await page.goto(`/#/tools/${tool}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await upload(page, 'test.pdf', await makePdf(pages), 'application/pdf')
  await page.waitForTimeout(2500)
}

/**
 * Pick a tool from inside the tools panel. Every category is closed to begin
 * with, so the one holding the tool has to be opened first.
 */
export async function selectToolInPanel(page: Page, label: string | RegExp) {
  const tool = page.getByRole('button', { name: label }).first()
  for (const group of ['עמודים', 'המרות', 'המסמך']) {
    if (await tool.isVisible().catch(() => false)) break
    await page.getByRole('button', { name: new RegExp(`^${group}`) }).first().click()
    await page.waitForTimeout(320)
  }
  await tool.click()
  await page.waitForTimeout(400)
}

/** Open one category section of the tools panel. */
export async function openToolGroup(page: Page, group: string) {
  const header = page.getByRole('button', { name: new RegExp(`^${group}`) }).first()
  if ((await header.getAttribute('aria-expanded')) !== 'true') {
    await header.click()
    await page.waitForTimeout(320)
  }
}

/** Confirm the file-name dialog and return the triggered download. */
export async function confirmDownload(page: Page) {
  await page.waitForTimeout(500)
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 25_000 }),
    page.getByRole('button', { name: 'הורד', exact: true }).last().click(),
  ])
  return download
}

/** Fail the test on any uncaught page error. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  return errors
}
