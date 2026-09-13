import { test, expect } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { confirmDownload, trackErrors } from './fixtures'

const here = dirname(fileURLToPath(import.meta.url))

// Both fixtures are real encrypted PDFs (3 pages, "PAGE n"):
//   locked-user.pdf  — needs the password "sod1234" to open at all
//   restricted.pdf   — opens freely but forbids printing and copying
const asset = (name: string) => readFileSync(join(here, 'assets', name))

async function pick(page: import('@playwright/test').Page, name: string) {
  await page.goto('/#/tools/unlock', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await page.locator('input[type="file"][accept=".pdf"]').last()
    .setInputFiles({ name, mimeType: 'application/pdf', buffer: asset(name) })
  await page.waitForTimeout(400)
}

/** Loading without ignoreEncryption only succeeds on a genuinely plain PDF. */
async function expectUnencrypted(bytes: Buffer, pages: number) {
  const out = await PDFDocument.load(bytes)
  expect(out.getPageCount()).toBe(pages)
  expect(bytes.toString('latin1')).not.toContain('/Encrypt')
}

test.describe('unlock PDF', () => {
  test('strips the restrictions from a locked-down file', async ({ page }) => {
    const errors = trackErrors(page)
    await pick(page, 'restricted.pdf')

    await page.getByRole('button', { name: 'הסר הגנה והורד' }).click()
    const download = await confirmDownload(page)
    await expectUnencrypted(readFileSync((await download.path())!), 3)

    expect(errors).toEqual([])
  })

  test('asks for the password, then unlocks with the right one', async ({ page }) => {
    await pick(page, 'locked-user.pdf')

    // No password: say so rather than fail silently
    await page.getByRole('button', { name: 'הסר הגנה והורד' }).click()
    await page.waitForTimeout(4000)
    await expect(page.getByRole('alert')).toContainText('מוגן בסיסמה')

    // Wrong password gets its own message
    await page.getByLabel(/סיסמה/).fill('nope')
    await page.getByRole('button', { name: 'הסר הגנה והורד' }).click()
    await page.waitForTimeout(4000)
    await expect(page.getByRole('alert')).toContainText('שגויה')

    // Right password: a plain, openable PDF with all three pages
    await page.getByLabel(/סיסמה/).fill('sod1234')
    await page.getByRole('button', { name: 'הסר הגנה והורד' }).click()
    const download = await confirmDownload(page)
    await expectUnencrypted(readFileSync((await download.path())!), 3)
  })
})

/**
 * Opening a protected file straight in the editor.
 *
 * This is a different path from the unlock tool: the file can be dropped on
 * the editor or picked from the home page, so the asking cannot live inside
 * one tool's panel. It used to be the browser's own grey prompt.
 */
test.describe('the password dialog', () => {
  const open = async (page: import('@playwright/test').Page) => {
    await page.goto('/#/editor', { waitUntil: 'networkidle' })
    await page.waitForTimeout(700)
    await page.locator('input[type="file"][accept*="pdf"]').last()
      .setInputFiles({
        name: 'locked-user.pdf',
        mimeType: 'application/pdf',
        buffer: asset('locked-user.pdf'),
      })
  }

  test('asks in the app rather than in a browser box', async ({ page }) => {
    // A native prompt would block the page and never resolve here, so if the
    // dialog under test were window.prompt this would hang rather than pass
    let nativePrompts = 0
    page.on('dialog', async d => { nativePrompts++; await d.dismiss() })

    await open(page)
    const field = page.locator('input[type="password"]')
    await expect(field).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('הקובץ מוגן בסיסמה')).toBeVisible()
    expect(nativePrompts).toBe(0)
  })

  test('the right password opens the document', async ({ page }) => {
    await open(page)
    await page.locator('input[type="password"]').fill('sod1234')
    await page.getByRole('button', { name: 'פתח', exact: true }).click()
    await page.waitForTimeout(4000)
    await expect(page.locator('canvas.pdf-canvas').first()).toBeVisible()
  })

  test('a wrong password says so and asks again', async ({ page }) => {
    await open(page)
    await page.locator('input[type="password"]').fill('nope')
    await page.getByRole('button', { name: 'פתח', exact: true }).click()
    await page.waitForTimeout(2500)
    await expect(page.getByText('הסיסמה שגויה — נסה שוב')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('backing out is quiet — a choice, not an error', async ({ page }) => {
    await open(page)
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'ביטול' }).click()
    await page.waitForTimeout(2500)
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
    // No error shouted about a decision the user made on purpose
    await expect(page.getByText(/שגיאה בטעינת הקובץ|הקובץ מוגן בסיסמה/)).toHaveCount(0)
  })
})
