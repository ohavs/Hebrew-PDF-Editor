import { test, expect } from '@playwright/test'
import { makeTextPdf, makeTablePdf, upload } from './fixtures'
import { PDFDocument } from 'pdf-lib'

/**
 * Pointing at existing text.
 *
 * The round trip — pick a line, replace it, export — is covered in
 * tools.spec.ts. What is checked here is the aim: a line is only about one
 * font size tall, so a click plainly meant for it has to land, and a click
 * that finds nothing has to say which kind of nothing it found.
 */

/** A one-page PDF with no text at all — a scan, as far as the tool can tell. */
async function makeTextlessPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create()
  doc.addPage([595, 842])
  return Buffer.from(await doc.save())
}

async function openInEditor(page: import('@playwright/test').Page, name: string, bytes: Buffer) {
  await page.goto('/#/editor', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await upload(page, name, bytes, 'application/pdf')
  await page.waitForTimeout(2500)
}

/**
 * Turn on the "edit existing text" tool. On a phone it lives behind "עוד"
 * rather than in the toolbar.
 */
async function armEditText(page: import('@playwright/test').Page, isMobile: boolean) {
  if (isMobile) await page.getByRole('button', { name: 'עוד' }).first().click()
  await page.getByRole('button', { name: 'ערוך טקסט' }).first().click()
  await expect(page.locator('[data-text-edit-layer]').first()).toBeVisible()
}

/**
 * Where a line of the fixture sits inside page 0, in layer coordinates.
 * makeTextPdf draws at y = 760 - i*28 in PDF space on an 842pt page at size
 * 14, so the baseline is 82 + i*28 down from the top.
 */
function lineCenter(index: number) {
  return { x: 110, y: 82 + index * 28 - 5 }
}

test.describe('pointing at existing text', () => {
  test('a point well below the line still picks that line', async ({ page, isMobile }) => {
    await openInEditor(page, 'text.pdf', await makeTextPdf([['Only line']]))
    await armEditText(page, isMobile)

    const layer = page.locator('[data-text-edit-layer]').first()
    const box = (await layer.boundingBox())!
    const scale = box.width / 595

    // Below the glyph box, descenders included, but still plainly aimed at the
    // only line on the page. With the slack removed this finds nothing.
    const p = lineCenter(0)
    await page.mouse.move(box.x + p.x * scale, box.y + (p.y + 15) * scale)
    await expect(page.locator('[data-text-edit-hover]')).toBeVisible({ timeout: 5000 })
  })

  test('columns on the same row stay separate lines', async ({ page, isMobile }) => {
    // Three cells across the page, all sharing one baseline
    await openInEditor(page, 'table.pdf', await makeTablePdf([['Left', 'Middle', 'Right']]))
    await armEditText(page, isMobile)

    const layer = page.locator('[data-text-edit-layer]').first()
    const box = (await layer.boundingBox())!
    const scale = box.width / 595

    // The first cell is drawn at x=60, its row baseline 82 down from the top
    await page.mouse.move(box.x + 70 * scale, box.y + 77 * scale)
    const hover = page.locator('[data-text-edit-hover]')
    await expect(hover).toBeVisible({ timeout: 5000 })

    // Only "Left" is picked. Grouped by baseline alone, the highlight would
    // stretch past the third column at x=420.
    const hoverBox = (await hover.boundingBox())!
    expect(hoverBox.width / scale).toBeLessThan(120)
  })

  test('says so when the page carries no text at all', async ({ page, isMobile }) => {
    await openInEditor(page, 'scan.pdf', await makeTextlessPdf())
    await armEditText(page, isMobile)

    const layer = page.locator('[data-text-edit-layer]').first()
    const box = (await layer.boundingBox())!
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 3)

    await expect(page.getByText(/אין בדף הזה טקסט הניתן לעריכה/)).toBeVisible({ timeout: 5000 })
  })

  test('a point far from any text reports a miss, not a scan', async ({ page, isMobile }) => {
    await openInEditor(page, 'text.pdf', await makeTextPdf([['Only line']]))
    await armEditText(page, isMobile)

    const layer = page.locator('[data-text-edit-layer]').first()
    const box = (await layer.boundingBox())!
    // The bottom of the page, hundreds of points from the single line at the top
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.9)

    await expect(page.getByText(/לא נמצא טקסט במקום הזה/)).toBeVisible({ timeout: 5000 })
  })
})
