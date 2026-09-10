import { test, expect } from '@playwright/test'
import { PDFDocument, PDFName } from 'pdf-lib'
import { readFileSync } from 'fs'
import { makeStampedPdf, makePdf, upload, confirmDownload, trackErrors } from './fixtures'

/**
 * Marks that arrive inside the file.
 *
 * The case this covers is a "DEMO VERSION" stamp carried as an annotation with
 * no appearance stream. Nothing paints it, so the page looks like blank paper
 * where it should be; its words are not page text, so the text tools cannot
 * see it; and until now there was no way to take it out.
 */

/** The marks tool as its own page, with the given document already open. */
async function openMarksTool(page: import('@playwright/test').Page, bytes: Buffer) {
  await page.goto('/#/tools/marks', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await upload(page, 'demo.pdf', bytes, 'application/pdf')
  await page.waitForTimeout(3000)
}

test.describe('marks that came with the file', () => {
  test('an unpainted stamp is shown rather than left as blank paper', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/#/editor', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await upload(page, 'demo.pdf', await makeStampedPdf(1), 'application/pdf')
    await page.waitForTimeout(3000)

    // pdf.js paints nothing for it, so the canvas itself stays blank there…
    const inkOnCanvas = await page.evaluate(() => {
      const c = document.querySelector('#page-0 canvas.pdf-canvas') as HTMLCanvasElement
      // The stamp sits at y 500..570 of an 842pt page — about a third down
      const top = Math.floor(c.height * 0.31)
      const d = c.getContext('2d')!.getImageData(0, top, c.width, Math.floor(c.height * 0.1)).data
      let ink = 0
      for (let i = 0; i < d.length; i += 4) if (d[i] < 200) ink++
      return ink
    })
    expect(inkOnCanvas).toBe(0)

    // …so the stand-in is what makes it visible at all
    await expect(page.locator('[data-unpainted-marks]').first()).toContainText('DEMO VERSION')
    expect(errors).toEqual([])
  })

  test('the tool lists what the file carries, and removes only what is chosen', async ({ page }) => {
    await openMarksTool(page, await makeStampedPdf(2))

    // Two pages, each with a stamp and a note
    const rows = page.locator('label:has(input[type="checkbox"])')
    await expect(rows).toHaveCount(4)
    await expect(page.getByText('DEMO VERSION').first()).toBeVisible()
    // The stamps are called out as invisible; the notes are not
    await expect(page.getByText(/לא נראה בדף/).first()).toBeVisible()

    await page.getByRole('button', { name: 'נקה בחירה' }).click()
    for (const row of await rows.all()) {
      if ((await row.innerText()).includes('DEMO VERSION')) await row.locator('input').check()
    }

    await page.getByRole('button', { name: /הסר 2 ופתח בעורך/ }).click()
    await page.waitForTimeout(3000)

    // Reopening the tool on the rebuilt document shows only the notes
    const after = page.locator('label:has(input[type="checkbox"])')
    await expect(after).toHaveCount(2)
    await expect(page.getByText('DEMO VERSION')).toHaveCount(0)
    await expect(page.getByText('keep me').first()).toBeVisible()
  })

  test('removing every mark keeps the pages and their real text', async ({ page }) => {
    await openMarksTool(page, await makeStampedPdf(2))

    await page.getByRole('button', { name: 'בחר הכל' }).click()
    await page.getByRole('button', { name: /הסר והורד PDF/ }).click()
    const download = await confirmDownload(page)

    const out = await PDFDocument.load(readFileSync((await download.path())!))
    expect(out.getPageCount()).toBe(2)
    for (const p of out.getPages()) {
      expect(p.node.lookup(PDFName.of('Annots'))).toBeUndefined()
    }
  })

  test('a file with no marks says so instead of offering nothing', async ({ page }) => {
    await openMarksTool(page, await makePdf(1))
    await expect(page.getByText(/לא נמצאו חותמות/)).toBeVisible()
  })

  test('removes the mark itself, not whatever sits at its position', async ({ page }) => {
    // A link comes first in the file's annotation list. The tool does not list
    // links, so the stamp is first on screen and second in the file — address
    // it by position and the link is what gets deleted.
    await openMarksTool(page, await makeStampedPdf(1, 'DEMO VERSION', { leadingLink: true }))

    const rows = page.locator('label:has(input[type="checkbox"])')
    await expect(rows).toHaveCount(2) // the stamp and the note, not the link

    await page.getByRole('button', { name: 'נקה בחירה' }).click()
    for (const row of await rows.all()) {
      if ((await row.innerText()).includes('DEMO VERSION')) await row.locator('input').check()
    }
    await page.getByRole('button', { name: /הסר והורד PDF/ }).click()
    const download = await confirmDownload(page)

    const out = await PDFDocument.load(readFileSync((await download.path())!))
    const annots = out.getPage(0).node.lookup(PDFName.of('Annots')) as any
    const subtypes = annots.asArray()
      .map((r: any) => out.context.lookup(r))
      .map((d: any) => d.get(PDFName.of('Subtype')).asString())
    // The stamp is gone; the link and the note are untouched
    expect(subtypes).not.toContain('/FreeText')
    expect(subtypes).toContain('/Link')
    expect(subtypes).toContain('/Text')
  })
})
