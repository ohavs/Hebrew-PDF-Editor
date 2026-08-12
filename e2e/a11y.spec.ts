import { test, expect } from '@playwright/test'
import { makePdf, upload, confirmDownload } from './fixtures'

test.describe('accessibility', () => {
  test('every button carries an accessible name', async ({ page }) => {
    await page.goto('/#/editor', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await upload(page, 'test.pdf', await makePdf(2), 'application/pdf')
    await page.waitForTimeout(3000)

    const unnamed = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button'))
        .filter(b => {
          const name = b.getAttribute('aria-label')
            || b.getAttribute('title')
            || (b.textContent || '').trim()
          return !name
        })
        .map(b => b.outerHTML.slice(0, 120)))

    expect(unnamed, `buttons with no accessible name:\n${unnamed.join('\n')}`).toEqual([])
  })

  test('keyboard focus stays visible on the toolbar', async ({ page }) => {
    await page.goto('/#/editor', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await upload(page, 'test.pdf', await makePdf(2), 'application/pdf')
    await page.waitForTimeout(3000)

    // Tab to the first toolbar control and read back its computed outline.
    // Several buttons set `outline: none` inline, which used to win over the
    // :focus-visible rule and leave keyboard users with no indication at all.
    await page.keyboard.press('Tab')
    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement
      if (!el || el === document.body) return null
      const s = getComputedStyle(el)
      return { tag: el.tagName, width: s.outlineWidth, style: s.outlineStyle }
    })
    expect(outline).not.toBeNull()
    expect(outline!.style).not.toBe('none')
    expect(parseFloat(outline!.width)).toBeGreaterThan(0)
  })

  test('the editor offers a back step next to home', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await page.goto('/#/editor', { waitUntil: 'networkidle' })
    await page.waitForTimeout(700)

    const back = page.getByRole('button', { name: 'חזור', exact: true })
    await expect(back).toBeVisible()
    await expect(page.getByRole('button', { name: /דף (הבית|ראשי)/ })).toBeVisible()

    await back.click()
    await page.waitForTimeout(600)
    await expect(page).not.toHaveURL(/#\/editor/)
  })

  test('download downloads, share shares', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'the editor header is phone chrome')
    await page.goto('/#/editor', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await upload(page, 'test.pdf', await makePdf(2), 'application/pdf')
    await page.waitForTimeout(3000)

    // Both actions exist, each under its own name
    await expect(page.getByRole('button', { name: 'הורד', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'שתף', exact: true })).toBeVisible()

    // Record what the share button reaches for
    await page.evaluate(() => {
      ;(window as any).__shared = false
      ;(navigator as any).canShare = () => true
      ;(navigator as any).share = async () => { (window as any).__shared = true }
    })

    // The download button must produce a file, not open the share sheet
    await page.getByRole('button', { name: 'הורד', exact: true }).click()
    const download = await confirmDownload(page)
    expect((await download.path())).toBeTruthy()
    expect(await page.evaluate(() => (window as any).__shared)).toBe(false)

    // ...and the share button must go to the share sheet
    await page.getByRole('button', { name: 'שתף', exact: true }).click()
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: 'הורד', exact: true }).last().click()
    await page.waitForTimeout(3000)
    expect(await page.evaluate(() => (window as any).__shared)).toBe(true)
  })

  test('dialogs announce themselves and close on Escape', async ({ page }) => {
    await page.goto('/#/editor', { waitUntil: 'networkidle' })
    await page.waitForTimeout(700)

    // Settings sits in the desktop toolbar, but behind "עוד" on a phone
    if (await page.getByRole('button', { name: 'הגדרות' }).count() === 0) {
      await page.getByRole('button', { name: 'עוד' }).first().click()
      await page.waitForTimeout(400)
    }
    await page.getByRole('button', { name: 'הגדרות' }).first().click()
    await page.waitForTimeout(400)
    const dialog = page.getByRole('dialog', { name: 'הגדרות' })
    await expect(dialog).toBeVisible()

    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
    await expect(dialog).toBeHidden()
  })
})
