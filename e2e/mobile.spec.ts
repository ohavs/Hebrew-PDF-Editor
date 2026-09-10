import { test, expect } from '@playwright/test'
import { makePdf, upload } from './fixtures'

async function openEditor(page: import('@playwright/test').Page) {
  await page.goto('/#/editor', { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await upload(page, 'test.pdf', await makePdf(2), 'application/pdf')
  await page.waitForTimeout(3000)
}

test.describe('mobile interaction', () => {
  test('a zoomed page can be panned to both edges', async ({ page }) => {
    await openEditor(page)

    // Zoom in until the page really is wider than the window — a phone gets
    // there in one step, a desktop viewport takes several
    for (let i = 0; i < 20; i++) {
      const wide = await page.evaluate(() => {
        const el = document.querySelector('.pdf-scroll-container') as HTMLElement
        const pageEl = document.querySelector('#page-0') as HTMLElement
        return pageEl.getBoundingClientRect().width > el.clientWidth + 40
      })
      if (wide) break
      await page.keyboard.press('=')
      await page.waitForTimeout(250)
    }
    await page.waitForTimeout(1000)

    const metrics = await page.evaluate(() => {
      const el = document.querySelector('.pdf-scroll-container') as HTMLElement
      const pageEl = document.querySelector('#page-0') as HTMLElement
      el.scrollLeft = -99999 // RTL scrollLeft goes negative; clamps either way
      const min = el.scrollLeft
      el.scrollLeft = 99999
      const max = el.scrollLeft
      return {
        overflow: el.scrollWidth - el.clientWidth,
        reachable: Math.abs(max - min),
        pageWidth: pageEl.getBoundingClientRect().width,
        viewport: el.clientWidth,
      }
    })

    // The page really is wider than the window...
    expect(metrics.pageWidth).toBeGreaterThan(metrics.viewport)
    // ...and every overflowing pixel can be scrolled to. Centring a flex item
    // that overflows used to make the leading side unreachable.
    expect(metrics.overflow).toBeGreaterThan(0)
    expect(metrics.reachable).toBeGreaterThanOrEqual(metrics.overflow - 2)
  })

  test('tool settings open on request, not on every tool switch', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'the settings drawer is phone chrome')
    await openEditor(page)
    const settings = page.getByRole('dialog', { name: 'הגדרות כלי' })
    const openButton = page.getByRole('button', { name: 'הגדרות כלי' })

    // Picking a tool must not throw its settings over the document
    await page.getByRole('button', { name: 'טקסט' }).first().click()
    await page.waitForTimeout(600)
    await expect(settings).toBeHidden()

    // The settings button opens them...
    await openButton.click()
    await page.waitForTimeout(500)
    await expect(settings).toBeVisible()

    // ...and dragging the sheet down puts it away
    const grip = page.locator('.mobile-props-grip')
    const box = (await grip.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 160, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(600)
    await expect(settings).toBeHidden()
  })

  test('tapping a selected text box starts editing it', async ({ page }) => {
    await openEditor(page)

    // Place a text box
    await page.getByRole('button', { name: 'טקסט' }).first().click()
    await page.waitForTimeout(400)
    const pageBox = (await page.locator('#page-0').boundingBox())!
    await page.mouse.click(pageBox.x + pageBox.width / 2, pageBox.y + 160)
    await page.waitForTimeout(600)

    const editable = page.locator('[contenteditable="true"]')
    await expect(editable).toHaveCount(1)
    await editable.fill?.('') // no-op guard for older Playwright
    await page.keyboard.type('שלום')
    await page.waitForTimeout(300)

    // Leave the box, then come back to it. The empty spot has to be inside
    // the window as well as inside the page — anchoring it to the page's
    // bottom edge put it below the fold as soon as the toolbar grew, and a
    // click that lands nowhere leaves the box selected and the test lying.
    await page.getByRole('button', { name: 'בחר' }).first().click()
    await page.waitForTimeout(400)
    const empty = {
      x: pageBox.x + 40,
      y: Math.min(pageBox.y + pageBox.height - 40, page.viewportSize()!.height - 60),
    }
    await page.mouse.click(empty.x, empty.y)
    await page.waitForTimeout(400)
    await expect(page.locator('[contenteditable="true"]')).toHaveCount(0)

    const target = { x: pageBox.x + pageBox.width / 2, y: pageBox.y + 175 }
    await page.mouse.click(target.x, target.y)   // first tap selects
    await page.waitForTimeout(300)
    await page.mouse.click(target.x, target.y)   // second tap edits — no 300ms race
    await page.waitForTimeout(500)

    await expect(page.locator('[contenteditable="true"]')).toHaveCount(1)
  })
})
