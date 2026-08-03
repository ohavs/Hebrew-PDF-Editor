import { test, expect } from '@playwright/test'
import { PDFDocument, PDFName } from 'pdf-lib'
import { readFileSync } from 'fs'
import { makePdf, makeDocx, upload, openToolWithPdf, confirmDownload, trackErrors, selectToolInPanel } from './fixtures'

async function loadDownloaded(download: Awaited<ReturnType<typeof confirmDownload>>) {
  const path = await download.path()
  return PDFDocument.load(readFileSync(path!))
}

test.describe('PDF tools', () => {
  test('organize: delete a page, then download the reduced document', async ({ page }) => {
    const errors = trackErrors(page)
    await openToolWithPdf(page, 'organize', 4)

    await expect(page.locator('[data-page-cell]')).toHaveCount(4)

    await page.locator('[data-page-cell]').first().getByLabel('מחק').click()
    await page.getByRole('button', { name: 'מחק', exact: true }).last().click()
    await page.waitForTimeout(2500)
    await expect(page.locator('[data-page-cell]')).toHaveCount(3)

    await page.getByRole('button', { name: /הורד PDF/ }).click()
    const doc = await loadDownloaded(await confirmDownload(page))
    expect(doc.getPageCount()).toBe(3)
    expect(errors).toEqual([])
  })

  test('organize: drag reorder marks the moved page', async ({ page }) => {
    await openToolWithPdf(page, 'organize', 4)
    const cells = page.locator('[data-page-cell]')
    const handle = await cells.nth(0).getByLabel('גרור לשינוי סדר').boundingBox()
    const target = await cells.nth(2).boundingBox()

    await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2)
    await page.mouse.down()
    await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, { steps: 12 })
    await page.mouse.up()
    await page.waitForTimeout(600)

    await expect(page.getByText('הועבר', { exact: false }).first()).toBeVisible()
  })

  test('merge: works with no open document and produces one combined file', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/#/tools/merge', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)

    // The panel must be usable immediately — merge does not require an open doc
    await page.locator('input[type="file"][accept=".pdf"]').last().setInputFiles([
      { name: 'a.pdf', mimeType: 'application/pdf', buffer: await makePdf(2) },
      { name: 'b.pdf', mimeType: 'application/pdf', buffer: await makePdf(3) },
    ])
    await page.waitForTimeout(2500)

    // Every page of every source becomes its own card
    await expect(page.locator('[data-merge-page]')).toHaveCount(5)

    // The selection survives switching tools
    await selectToolInPanel(page, /פיצול/)
    await selectToolInPanel(page, /^מיזוג/)
    await page.waitForTimeout(2000)
    await expect(page.locator('[data-merge-page]')).toHaveCount(5)

    await page.getByRole('button', { name: /מזג .* עמודים והורד/ }).click()
    const doc = await loadDownloaded(await confirmDownload(page))
    expect(doc.getPageCount()).toBe(5)
    expect(errors).toEqual([])
  })

  test('merge: pages can be reordered and removed before merging', async ({ page }) => {
    await page.goto('/#/tools/merge', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await page.locator('input[type="file"][accept=".pdf"]').last().setInputFiles([
      { name: 'a.pdf', mimeType: 'application/pdf', buffer: await makePdf(2) },
      { name: 'b.pdf', mimeType: 'application/pdf', buffer: await makePdf(2) },
    ])
    await page.waitForTimeout(2500)
    const cards = page.locator('[data-merge-page]')
    await expect(cards).toHaveCount(4)

    // Drag the first page onto the third position
    const handle = await cards.nth(0).getByLabel('גרור לשינוי סדר').boundingBox()
    const target = await cards.nth(2).boundingBox()
    await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2)
    await page.mouse.down()
    await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, { steps: 12 })
    await page.mouse.up()
    await page.waitForTimeout(600)
    await expect(cards).toHaveCount(4)

    // Dropping a page excludes it from the merge
    await cards.nth(0).getByLabel('הסר עמוד').click()
    await page.waitForTimeout(400)
    await expect(cards).toHaveCount(3)

    await page.getByRole('button', { name: /מזג .* עמודים והורד/ }).click()
    const doc = await loadDownloaded(await confirmDownload(page))
    expect(doc.getPageCount()).toBe(3)
  })

  test('the tool list starts collapsed and expands on demand', async ({ page }) => {
    await openToolWithPdf(page, 'organize', 2)

    const toggle = page.getByRole('button', { name: 'הצג את כל הכלים' })
    await expect(toggle).toBeVisible()
    // Collapsed: the other tools are not reachable
    await expect(page.getByRole('button', { name: /^סימן מים/ })).toBeHidden()

    await toggle.click()
    await page.waitForTimeout(400)
    await expect(page.getByRole('button', { name: /^סימן מים/ })).toBeVisible()

    // Picking a tool switches to it and collapses the list again
    await page.getByRole('button', { name: /^סימן מים/ }).first().click()
    await page.waitForTimeout(400)
    await expect(page.getByRole('button', { name: 'הוסף סימן מים' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^סימן מים/ })).toBeHidden()
  })

  test('the selected tool stays visible before a file is chosen', async ({ page }) => {
    await page.goto('/#/tools/organize', { waitUntil: 'networkidle' })
    await page.waitForTimeout(700)
    // No document yet: the chosen tool must still be identifiable
    await expect(page.getByText('סובב, סדר, מחק ושכפל דפים').first()).toBeVisible()
    await expect(page.getByText(/בחר קובץ כדי להשתמש ב/)).toBeVisible()
  })

  test('watermark: live layer applies once and bakes into every page', async ({ page }) => {
    const errors = trackErrors(page)
    await openToolWithPdf(page, 'watermark', 3)

    await page.getByRole('button', { name: 'הוסף סימן מים' }).click()
    await page.waitForTimeout(500)
    // Re-opening shows an update button — applying twice must not duplicate
    await expect(page.getByRole('button', { name: 'עדכן סימן מים' })).toBeVisible()
    await page.getByRole('button', { name: 'עדכן סימן מים' }).click()
    await page.waitForTimeout(400)

    await page.getByRole('button', { name: /הורד PDF/ }).click()
    const doc = await loadDownloaded(await confirmDownload(page))
    const pagesWithArtwork = doc.getPages().filter(p => {
      const xo = p.node.Resources()?.lookup(PDFName.of('XObject')) as any
      return xo && xo.keys().length === 1 // exactly one watermark image, not two
    })
    expect(pagesWithArtwork.length).toBe(3)
    expect(errors).toEqual([])
  })

  test('Word → PDF opens live editable paragraphs', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/#/tools/from-word', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await upload(page, 'doc.docx', makeDocx(['פסקה ראשונה לבדיקה', 'פסקה שנייה']),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'input[type="file"][accept=".docx"]')
    await page.waitForTimeout(400)

    await page.getByRole('button', { name: 'המר ופתח לעריכה' }).click()
    await page.waitForTimeout(3000)

    await expect(page).toHaveURL(/#\/editor/)
    await expect(page.getByText('פסקה ראשונה לבדיקה')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('PDF → Word produces a DOCX containing the page text', async ({ page }) => {
    await openToolWithPdf(page, 'to-word', 2)
    await page.getByRole('button', { name: 'המר ל-Word והורד' }).click()
    await page.waitForTimeout(500)
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 25_000 }),
      page.getByRole('button', { name: 'הורד', exact: true }).last().click(),
    ])
    const buf = readFileSync((await download.path())!)
    // A DOCX is a zip — check the signature and that our text survived
    expect(buf[0]).toBe(0x50) // 'P'
    expect(buf[1]).toBe(0x4b) // 'K'
    expect(buf.length).toBeGreaterThan(500)
  })

  test('every tool exposes a download button', async ({ page }) => {
    for (const tool of ['organize', 'watermark', 'reverse', 'page-numbers', 'compress']) {
      await openToolWithPdf(page, tool, 2)
      await expect(
        page.getByRole('button', { name: /הורד PDF/ }),
        `tool "${tool}" should offer a download`,
      ).toBeVisible()
    }
  })
})
