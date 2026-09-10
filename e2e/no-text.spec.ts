import { test, expect } from '@playwright/test'
import { PDFDocument, rgb } from 'pdf-lib'
import { makePdf, upload } from './fixtures'

/**
 * A document with no text layer.
 *
 * This is what a scan is, and what a flipbook turned into a PDF is: pages that
 * paint a picture and nothing else. Search over one correctly finds nothing —
 * but a bare "0" is indistinguishable from a broken search, so the reason has
 * to be said.
 */

/** Pages that paint, but carry no text whatsoever. */
async function makeTextlessPdf(pages = 2): Promise<Buffer> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([595, 842])
    page.drawRectangle({ x: 40, y: 40, width: 515, height: 762, color: rgb(0.85, 0.87, 0.9) })
  }
  return Buffer.from(await doc.save())
}

async function openAndSearch(page: import('@playwright/test').Page, bytes: Buffer, term: string) {
  await page.goto('/#/editor', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await upload(page, 'doc.pdf', bytes, 'application/pdf')
  await page.waitForTimeout(3000)
  await page.getByRole('button', { name: /חיפוש/ }).first().click()
  await page.waitForTimeout(400)
  await page.locator('input[placeholder="חיפוש במסמך…"]').fill(term)
  await page.waitForTimeout(2500)
}

test.describe('searching a document with no text', () => {
  test('says the file has no text layer instead of showing a bare zero', async ({ page }) => {
    await openAndSearch(page, await makeTextlessPdf(2), 'anything')
    await expect(page.locator('[data-search-explains]'))
      .toContainText(/אין שכבת טקסט כלל/, { timeout: 10_000 })
  })

  test('a real miss in a real document says nothing extra', async ({ page }) => {
    // "PAGE 1" is there; "zzzz" is not — an ordinary empty result
    await openAndSearch(page, await makePdf(2), 'zzzznotpresent')
    await expect(page.locator('[data-search-explains]')).toHaveCount(0)
  })

  test('finding a word still works', async ({ page }) => {
    await openAndSearch(page, await makePdf(2), 'PAGE')
    await expect(page.locator('[data-search-explains]')).toHaveCount(0)
    await expect(page.locator('.pdf-page-wrapper').first()).toBeVisible()
  })
})
