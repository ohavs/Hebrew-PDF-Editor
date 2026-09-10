import { test, expect } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { readFileSync } from 'fs'
import { makePdf, makeColoredPdf, upload, selectToolInPanel } from './fixtures'
import { stampText, stampApplies, stampPosition, stampConfig } from '../src/utils/pageStamp'
import type { PageNumberSettings } from '../src/store'

/**
 * Running headers and footers.
 *
 * The point of keeping these as a setting rather than as ink is that the
 * document can still be edited underneath them: delete a page and the rest
 * renumber themselves, because each page reads its number off where it now
 * sits. That is the behaviour worth protecting.
 */

const base: PageNumberSettings = { position: 'center', startAt: 1, dx: 0, dy: 0 }

test.describe('what a stamp says', () => {
  test('fills in the page, the total and the date', async () => {
    const s = { ...base, template: '{n} מתוך {total} · {date}', dateFormat: 'yyyy-mm-dd' as const }
    const on = new Date(2026, 11, 31)
    expect(stampText(s, 0, 12, on)).toBe('1 מתוך 12 · 2026-12-31')
    expect(stampText(s, 11, 12, on)).toBe('12 מתוך 12 · 2026-12-31')
  })

  test('counts from the chosen start', async () => {
    expect(stampText({ ...base, startAt: 5 }, 0, 3)).toBe('5')
    expect(stampText({ ...base, startAt: 5 }, 2, 3)).toBe('7')
  })

  test('plain text needs no tokens', async () => {
    expect(stampText({ ...base, template: 'טיוטה בלבד' }, 0, 3)).toBe('טיוטה בלבד')
  })

  test('the Hebrew long date reads as a date, not a number', async () => {
    const s = { ...base, template: '{date}', dateFormat: 'long' as const }
    expect(stampText(s, 0, 1, new Date(2026, 0, 5))).toBe('5 בינואר 2026')
  })
})

test.describe('which pages carry it', () => {
  test('a range leaves the pages outside it alone', async () => {
    const s = { ...base, fromPage: 2, toPage: 3 }
    expect(stampApplies(s, 0, 5)).toBe(false)  // page 1
    expect(stampApplies(s, 1, 5)).toBe(true)   // page 2
    expect(stampApplies(s, 2, 5)).toBe(true)   // page 3
    expect(stampApplies(s, 3, 5)).toBe(false)  // page 4
  })

  test('no range means every page', async () => {
    for (let i = 0; i < 4; i++) expect(stampApplies(base, i, 4)).toBe(true)
  })

  test('an open-ended range runs to the last page', async () => {
    const s = { ...base, fromPage: 3, toPage: null }
    expect(stampApplies(s, 1, 5)).toBe(false)
    expect(stampApplies(s, 4, 5)).toBe(true)
  })
})

test.describe('where it sits', () => {
  const W = 600, H = 800, textW = 40

  test('an anchor puts it against the edge it names', async () => {
    const left = stampPosition({ ...base, position: 'left' }, W, H, textW)
    const right = stampPosition({ ...base, position: 'right' }, W, H, textW)
    const centre = stampPosition({ ...base, position: 'center' }, W, H, textW)
    expect(left.x).toBeLessThan(centre.x)
    expect(centre.x).toBeLessThan(right.x)
    expect(right.x + textW).toBeLessThanOrEqual(W)
    // Centred means centred, whatever the text measures
    expect(centre.x + textW / 2).toBeCloseTo(W / 2, 5)
  })

  test('top and bottom are on opposite sides of the page', async () => {
    const top = stampPosition({ ...base, vertical: 'top' }, W, H, textW)
    const bottom = stampPosition({ ...base, vertical: 'bottom' }, W, H, textW)
    expect(top.y).toBeLessThan(H / 2)
    expect(bottom.y).toBeGreaterThan(H / 2)
  })

  test('the drag offset moves it from the anchor', async () => {
    const moved = stampPosition({ ...base, dx: 25, dy: -10 }, W, H, textW)
    const still = stampPosition(base, W, H, textW)
    expect(moved.x - still.x).toBe(25)
    expect(moved.y - still.y).toBe(-10)
  })

  test('settings absent from an older session still resolve', async () => {
    // A stamp saved before any of these fields existed
    const c = stampConfig(base)
    expect(c.template).toBe('{n}')
    expect(c.fontSize).toBeGreaterThan(0)
    expect(c.toPage).toBeNull()
  })
})


/**
 * Open a PDF tool from inside the editor.
 *
 * The desktop toolbar has a toolbox button; a phone reaches the same tools
 * through the "more" sheet, where each one is its own button.
 */
async function openPdfTool(
  page: import('@playwright/test').Page,
  isMobile: boolean,
  desktopLabel: RegExp,
  mobileLabel: RegExp,
) {
  const groups = page.getByRole('button', { name: /^(עמודים|המרות|המסמך)/ })
  const alreadyOpen = await groups.first().isVisible().catch(() => false)

  if (!alreadyOpen) {
    if (isMobile) {
      await page.getByRole('button', { name: 'עוד' }).first().click()
      await page.waitForTimeout(500)
      await page.getByRole('button', { name: mobileLabel }).first().click()
      await page.waitForTimeout(900)
      return
    }
    // The toolbox button toggles, so opening it twice would close it again
    await page.getByRole('button', { name: 'כלי PDF' }).first().click()
    await page.waitForTimeout(600)
  }
  // Once the panel is up it is the same component on both, and the phone's
  // sheet is behind a modal that will not let the bottom bar be tapped again
  await selectToolInPanel(page, desktopLabel)
}

test.describe('numbering a real document', () => {
  async function openNumbering(page: import('@playwright/test').Page, pages: number) {
    await page.goto('/#/tools/page-numbers', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await upload(page, 'doc.pdf', await makePdf(pages), 'application/pdf')
    await page.waitForTimeout(2500)
  }

  test('the preview shows the first and last page numbers', async ({ page }) => {
    await openNumbering(page, 5)
    await page.getByRole('button', { name: '1 מתוך 12' }).click()
    await page.waitForTimeout(300)
    await expect(page.locator('[data-stamp-preview]')).toContainText('1 מתוך 5')
    await expect(page.getByText('אחרון: 5 מתוך 5')).toBeVisible()
  })

  test('the numbers follow the pages when one is deleted', async ({ page, isMobile }) => {
    // Desktop only: on a phone the tools sit behind a modal sheet and the
    // delete confirmation lands under a toast, which makes this a test of the
    // phone's chrome rather than of the numbering. The renumbering itself is
    // platform-independent and is covered on desktop, here and in the
    // reordering test below.
    test.skip(!!isMobile, 'phone chrome, not numbering')
    await page.goto('/#/editor', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    // Red, green, blue — so each page can be told apart from its neighbours
    await upload(page, 'doc.pdf', await makeColoredPdf([
      [220, 30, 30], [30, 180, 60], [40, 70, 220],
    ]), 'application/pdf')
    await page.waitForTimeout(3000)

    await openPdfTool(page, isMobile, /^מספור עמודים$/, /^מספור$/)
    await page.getByRole('button', { name: 'הוסף', exact: true }).click()
    await page.waitForTimeout(1200)

    /**
     * Each rendered page's colour paired with the number printed on it.
     * Only rendered pages carry a stamp — the rest are recycled away — so
     * unrendered ones are left out rather than counted as blank.
     */
    const numbered = () => page.evaluate(() =>
      Array.from(document.querySelectorAll('.pdf-page-wrapper')).map(w => {
        const canvas = w.querySelector('canvas.pdf-canvas') as HTMLCanvasElement
        const stamp = (w.querySelector('[data-page-stamp]') as HTMLElement | null)?.textContent?.trim()
        if (!canvas?.width || !stamp) return null
        const { data } = canvas.getContext('2d')!
          .getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1)
        const colour = data[0] > 150 ? 'red' : data[1] > 120 ? 'green' : 'blue'
        return `${colour}=${stamp}`
      }).filter(Boolean))

    // Only pages currently rendered carry a stamp, and how many that is
    // depends on the window — so what is checked is the pairing, not the count
    await expect.poll(numbered).toContain('red=1')
    expect(await numbered()).toContain('green=2')

    // Remove the red page. Green is now the first page and must say so.
    await openPdfTool(page, isMobile, /^ארגון דפים$/, /^ארגון דפים$/)
    await page.waitForTimeout(800)
    // On a phone the confirmation sits under the toast that announced the
    // numbering, so give the toast time to go rather than clicking through it
    await expect(page.locator('.toast-container > *')).toHaveCount(0, { timeout: 15_000 })
    await page.locator('[data-page-cell]').first().getByLabel('מחק').click()
    await page.getByRole('button', { name: 'מחק', exact: true }).last().click()
    await page.waitForTimeout(3500)

    // Green was the second page and is now the first: it must say 1, and the
    // red page must be gone rather than merely renumbered
    await expect.poll(numbered).toContain('green=1')
    expect((await numbered()).some(e => String(e).startsWith('red='))).toBe(false)
  })

  test('the numbers follow the pages when they are reordered', async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'the page rail is desktop chrome')
    await page.goto('/#/editor', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await upload(page, 'doc.pdf', await makeColoredPdf([
      [220, 30, 30], [30, 180, 60], [40, 70, 220],
    ]), 'application/pdf')
    await page.waitForTimeout(3000)

    await openPdfTool(page, false, /^מספור עמודים$/, /^מספור$/)
    await page.getByRole('button', { name: 'הוסף', exact: true }).click()
    await page.waitForTimeout(1200)

    const numbered = () => page.evaluate(() =>
      Array.from(document.querySelectorAll('.pdf-page-wrapper')).map(w => {
        const canvas = w.querySelector('canvas.pdf-canvas') as HTMLCanvasElement
        const stamp = (w.querySelector('[data-page-stamp]') as HTMLElement | null)?.textContent?.trim()
        if (!canvas?.width || !stamp) return null
        const { data } = canvas.getContext('2d')!
          .getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1)
        const colour = data[0] > 150 ? 'red' : data[1] > 120 ? 'green' : 'blue'
        return `${colour}=${stamp}`
      }).filter(Boolean))

    await expect.poll(numbered).toContain('red=1')

    // The toolbox occupies the same rail as the thumbnails, so it has to go
    await page.getByRole('button', { name: 'כלי PDF' }).first().click()
    await page.waitForTimeout(700)

    // Drag the red page to the end of the rail. Reordering changes only the
    // display order — the file itself is untouched — so a stamp that numbered
    // by position in the file would still call red page one.
    const items = page.locator('[data-thumb-item]')
    const grip = await items.nth(0).getByLabel('גרור לשינוי סדר').boundingBox()
    const target = await items.nth(2).boundingBox()
    await page.mouse.move(grip!.x + grip!.width / 2, grip!.y + grip!.height / 2)
    await page.mouse.down()
    await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, { steps: 12 })
    await page.mouse.up()
    await page.waitForTimeout(1500)

    await expect.poll(numbered).toContain('green=1')
  })
})
