import { test, expect } from '@playwright/test'
import { makePdf, upload, trackErrors } from './fixtures'

/** Canvases that still hold a bitmap (width > 0) — i.e. real memory. */
async function liveCanvases(page: import('@playwright/test').Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('canvas.pdf-canvas'))
      .filter(c => (c as HTMLCanvasElement).width > 0).length)
}

async function openInEditor(page: import('@playwright/test').Page, pages: number) {
  await page.goto('/#/editor', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await upload(page, 'big.pdf', await makePdf(pages), 'application/pdf')
  await page.waitForTimeout(3000)
}

test.describe('viewer', () => {
  test('recycles page canvases instead of accumulating them', async ({ page }) => {
    const errors = trackErrors(page)
    await openInEditor(page, 30)

    const container = page.locator('.pdf-scroll-container')

    // Scroll through the whole document
    for (let i = 0; i < 12; i++) {
      await container.evaluate(el => { el.scrollTop += el.clientHeight * 2 })
      await page.waitForTimeout(400)
    }
    await page.waitForTimeout(1500)

    const live = await liveCanvases(page)
    // Only the visible window (plus a one-page buffer either side) may hold
    // a bitmap. Before the fix this grew to every page ever scrolled past.
    expect(live).toBeLessThanOrEqual(8)
    expect(live).toBeGreaterThan(0)

    // Total canvas pixels must stay bounded regardless of document length
    const megapixels = await page.evaluate(() =>
      Array.from(document.querySelectorAll('canvas.pdf-canvas'))
        .reduce((sum, c) => sum + (c as HTMLCanvasElement).width * (c as HTMLCanvasElement).height, 0) / 1e6)
    expect(megapixels).toBeLessThan(120)

    expect(errors).toEqual([])
  })

  test('scrolling back re-renders recycled pages', async ({ page }) => {
    await openInEditor(page, 20)
    const container = page.locator('.pdf-scroll-container')

    await container.evaluate(el => { el.scrollTop = el.scrollHeight })
    await page.waitForTimeout(2000)
    await container.evaluate(el => { el.scrollTop = 0 })
    await page.waitForTimeout(2500)

    // The first page must be painted again, not left as an empty skeleton
    const firstPagePainted = await page.evaluate(() => {
      const c = document.querySelector('#page-0 canvas.pdf-canvas') as HTMLCanvasElement | null
      if (!c || c.width === 0) return false
      const ctx = c.getContext('2d')!
      const { data } = ctx.getImageData(0, 0, Math.min(c.width, 400), Math.min(c.height, 400))
      // A rendered page has white background pixels; a freed canvas is transparent
      return data.some((v, i) => i % 4 === 3 && v > 0)
    })
    expect(firstPagePainted).toBe(true)
  })

  test('page indicator follows scrolling', async ({ page }) => {
    await openInEditor(page, 15)
    const container = page.locator('.pdf-scroll-container')
    await container.evaluate(el => { el.scrollTop = el.scrollHeight / 2 })
    await page.waitForTimeout(1500)

    const shown = await page.locator('input.input').first().inputValue()
    expect(Number(shown)).toBeGreaterThan(1)
  })
})

test.describe('two-page view', () => {
  test('shows a spread that fits the window', async ({ page }) => {
    await page.goto('/#/editor', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await upload(page, 'spread.pdf', await makePdf(6), 'application/pdf')
    await page.waitForTimeout(3000)

    const toggle = page.getByRole('button', { name: 'שני דפים' })
    test.skip(await toggle.count() === 0, 'two-page is a desktop-only control')
    await toggle.click()
    await page.waitForTimeout(1500)

    // Pages 1 and 2 sit side by side — same row, different columns
    const first = await page.locator('#page-0').boundingBox()
    const second = await page.locator('#page-1').boundingBox()
    expect(Math.abs(first!.y - second!.y)).toBeLessThan(4)
    expect(Math.abs(first!.x - second!.x)).toBeGreaterThan(first!.width / 2)

    // ...and the spread fits: fitting one page's width used to leave the
    // second one hanging off the side
    const overflow = await page.locator('.pdf-scroll-container').evaluate(
      el => el.scrollWidth - el.clientWidth)
    expect(overflow).toBeLessThanOrEqual(2)
  })
})
