import { test, expect } from '@playwright/test'
import { PDFDocument, PDFArray, PDFName } from 'pdf-lib'
import { unzlibSync } from 'fflate'
import { readFileSync } from 'fs'

/** The drawing operators of one page, inflated if the stream is compressed. */
function pageOperators(doc: PDFDocument, index: number): string {
  const contents = doc.getPage(index).node.Contents()
  if (!contents) return ''
  const streams = contents instanceof PDFArray
    ? Array.from({ length: contents.size() }, (_, i) => doc.context.lookup(contents.get(i)) as any)
    : [contents as any]
  return streams.map(s => {
    const raw = s?.getContents?.()
    if (!raw) return ''
    const flate = String(s.dict?.get(PDFName.of('Filter')) ?? '').includes('FlateDecode')
    return Buffer.from(flate ? unzlibSync(raw) : raw).toString('latin1')
  }).join('')
}
import { makeTextPdf, upload, confirmDownload, trackErrors } from './fixtures'

const OLD = [
  ['Alpha', 'Beta', 'Gamma'],
  ['Second page unchanged'],
]
const NEW = [
  ['Alpha', 'Beta CHANGED', 'Gamma', 'Delta added'],
  ['Second page unchanged'],
]

test.describe('version compare', () => {
  test('reports what changed and marks it in a downloadable PDF', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/#/tools/compare', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)

    // The open document is the new revision
    await upload(page, 'new.pdf', await makeTextPdf(NEW), 'application/pdf')
    await page.waitForTimeout(2500)
    // ...compared against the older one
    await page.locator('input[type="file"][accept=".pdf"]').last()
      .setInputFiles({ name: 'old.pdf', mimeType: 'application/pdf', buffer: await makeTextPdf(OLD) })
    await page.waitForTimeout(500)

    await page.getByRole('button', { name: 'השווה' }).click()
    await page.waitForTimeout(6000)

    // Only page 1 differs
    await expect(page.locator('[data-diff-page]')).toHaveCount(1)
    await expect(page.locator('[data-diff-page="1"]')).toBeVisible()

    // The rewritten and the new line show as additions, the old one as a removal
    await expect(page.getByText('Beta CHANGED')).toBeVisible()
    await expect(page.getByText('Delta added')).toBeVisible()
    await expect(page.locator('[data-diff-page="1"]').getByText('Beta', { exact: true })).toBeVisible()

    // The pixel pass ran too — it is what catches changes the text layer
    // cannot see, so a text-only diff would silently pass this test
    await expect(page.getByText(/אזורים השתנו/)).toBeVisible()

    await page.getByRole('button', { name: 'הורד PDF עם סימון ההבדלים' }).click()
    const download = await confirmDownload(page)
    const bytes = readFileSync((await download.path())!)
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(2)

    // The red boxes really made it into the changed page — and only there
    expect(pageOperators(doc, 0)).toContain('0.86 0.15 0.15 RG')
    expect(pageOperators(doc, 1)).not.toContain('0.86 0.15 0.15 RG')

    expect(errors).toEqual([])
  })

  test('identical documents report no differences', async ({ page }) => {
    await page.goto('/#/tools/compare', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    const bytes = await makeTextPdf(OLD)
    await upload(page, 'a.pdf', bytes, 'application/pdf')
    await page.waitForTimeout(2500)
    await page.locator('input[type="file"][accept=".pdf"]').last()
      .setInputFiles({ name: 'b.pdf', mimeType: 'application/pdf', buffer: bytes })
    await page.waitForTimeout(500)

    await page.getByRole('button', { name: 'השווה' }).click()
    await page.waitForTimeout(6000)

    // The pixel pass must tolerate the noise two independent renders produce,
    // or every comparison would be a wall of false positives
    await expect(page.getByText('לא נמצאו הבדלים בין המסמכים')).toBeVisible()
    await expect(page.locator('[data-diff-page]')).toHaveCount(0)
  })
})
