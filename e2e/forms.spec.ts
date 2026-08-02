import { test, expect } from '@playwright/test'
import { PDFDocument, PDFName } from 'pdf-lib'
import { readFileSync } from 'fs'
import { makeFormPdf, upload, confirmDownload, trackErrors } from './fixtures'

async function openForm(page: import('@playwright/test').Page) {
  await page.goto('/#/editor', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await upload(page, 'form.pdf', await makeFormPdf(), 'application/pdf')
  await page.waitForTimeout(3000)
}

test.describe('PDF forms', () => {
  test('detects AcroForm fields and bakes the answers into the download', async ({ page }) => {
    const errors = trackErrors(page)
    await openForm(page)

    const textField = page.getByLabel('applicant.name')
    const checkbox = page.getByLabel('applicant.agree')
    await expect(textField).toBeVisible()
    await expect(checkbox).toBeVisible()

    await textField.fill('ישראל ישראלי')
    await checkbox.click()
    await expect(checkbox).toHaveAttribute('aria-checked', 'true')
    await page.waitForTimeout(400)

    await page.getByRole('button', { name: 'יצוא כ...' }).click()
    const download = await confirmDownload(page)
    const out = await PDFDocument.load(readFileSync((await download.path())!))

    // The values are drawn into the page, and the now-empty widgets — which
    // a viewer would paint on top of them — are gone
    expect(out.catalog.get(PDFName.of('AcroForm'))).toBeUndefined()
    const xobjects = out.getPage(0).node.Resources()?.lookup(PDFName.of('XObject')) as any
    expect(xobjects.keys().length).toBe(2) // the typed name + the tick

    expect(errors).toEqual([])
  })

  test('typed answers come back with the resumed session', async ({ page }) => {
    await openForm(page)
    await page.getByLabel('applicant.name').fill('בדיקה')
    // Leaving the app flushes the autosave — the same path a phone takes
    // when the tab is backgrounded
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')))
    await page.waitForTimeout(2000)

    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    await page.getByRole('button', { name: /form\.pdf/ }).first().click()
    await page.waitForTimeout(3000)

    await expect(page.getByLabel('applicant.name')).toHaveValue('בדיקה')
  })
})
