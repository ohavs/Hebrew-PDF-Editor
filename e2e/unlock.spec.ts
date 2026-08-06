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
