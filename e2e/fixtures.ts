import { PDFDocument, StandardFonts } from 'pdf-lib'
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

/** Upload a generated file into the first file input on the page. */
export async function upload(page: Page, name: string, buffer: Buffer, mimeType: string, selector = 'input[type="file"]') {
  await page.locator(selector).first().setInputFiles({ name, mimeType, buffer })
}

/** Open a document in the given tool of the quick-tools hub. */
export async function openToolWithPdf(page: Page, tool: string, pages = 3) {
  await page.goto(`/#/tools/${tool}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await upload(page, 'test.pdf', await makePdf(pages), 'application/pdf')
  await page.waitForTimeout(2500)
}

/**
 * Pick a tool from inside the tools panel. The list is collapsed by default,
 * so it has to be expanded first.
 */
export async function selectToolInPanel(page: Page, label: string | RegExp) {
  const toggle = page.getByRole('button', { name: /הצג את כל הכלים|סגור את רשימת הכלים/ })
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click()
    await page.waitForTimeout(350)
  }
  await page.getByRole('button', { name: label }).first().click()
  await page.waitForTimeout(400)
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
