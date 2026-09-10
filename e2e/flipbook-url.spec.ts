import { test, expect } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { readFileSync } from 'fs'
import { confirmDownload } from './fixtures'
import { parseFlipbookUrl } from '../src/utils/flipbookFetch'

/**
 * Fetching a FlipHTML5 publication by its address.
 *
 * The real host is never contacted: the requests are answered here, so the
 * test covers what the panel does with the answers — including the answer that
 * matters most, a browser refusing the request outright.
 */

/** A tiny valid JPEG, so pdf-lib has something real to embed. */
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA' +
  'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64')

/** Serve a publication of `pages` pages at the FlipHTML5 reader host. */
async function serveFlipbook(page: import('@playwright/test').Page, pages: number) {
  await page.route('https://online.fliphtml5.com/**', async route => {
    const url = route.request().url()
    if (url.endsWith('javascript/config.js')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        headers: { 'access-control-allow-origin': '*' },
        body: `var htmlConfig = { "totalPageCount": ${pages} };`,
      })
      return
    }
    const m = /files\/large\/(\d+)\.jpg$/.exec(url)
    if (m && Number(m[1]) <= pages) {
      await route.fulfill({
        status: 200,
        contentType: 'image/jpeg',
        headers: { 'access-control-allow-origin': '*' },
        body: JPEG,
      })
      return
    }
    await route.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: '' })
  })
}

async function openTool(page: import('@playwright/test').Page) {
  await page.goto('/#/tools/flipbook', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
}

const URL_FIELD = 'input[type="url"]'

test.describe('flipbook from a URL', () => {
  test('fetches the pages and binds them into a PDF', async ({ page }) => {
    await serveFlipbook(page, 3)
    await openTool(page)

    await page.locator(URL_FIELD).fill('https://fliphtml5.com/abcd/efgh/')
    await page.getByRole('button', { name: 'הבא עמודים' }).click()
    await expect(page.getByText('3 עמודים התקבלו מהכתובת')).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: 'צור PDF והורד' }).click()
    const download = await confirmDownload(page)
    const out = await PDFDocument.load(readFileSync((await download.path())!))
    expect(out.getPageCount()).toBe(3)
  })

  test('says plainly when the site refuses the browser', async ({ page }) => {
    // A request the browser cannot make at all — what a site without
    // cross-origin permission looks like from inside a page
    await page.route('https://online.fliphtml5.com/**', route => route.abort('failed'))
    await openTool(page)

    await page.locator(URL_FIELD).fill('https://fliphtml5.com/abcd/efgh/')
    await page.getByRole('button', { name: 'הבא עמודים' }).click()
    await expect(page.getByText(/לא מרשה לדפדפן למשוך ממנו את התמונות/)).toBeVisible({ timeout: 20_000 })
  })

  test('rejects an address that is not a flipbook', async ({ page }) => {
    await openTool(page)
    await page.locator(URL_FIELD).fill('https://example.com/some/page')
    await page.getByRole('button', { name: 'הבא עמודים' }).click()
    await expect(page.getByText(/לא נראית כמו פרסום של FlipHTML5/)).toBeVisible()
  })

  test('finds the end of a book whose config says nothing', async ({ page }) => {
    await page.route('https://online.fliphtml5.com/**', async route => {
      const url = route.request().url()
      const m = /files\/large\/(\d+)\.jpg$/.exec(url)
      if (m && Number(m[1]) <= 2) {
        await route.fulfill({
          status: 200, contentType: 'image/jpeg',
          headers: { 'access-control-allow-origin': '*' }, body: JPEG,
        })
        return
      }
      await route.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: '' })
    })
    await openTool(page)

    await page.locator(URL_FIELD).fill('https://online.fliphtml5.com/abcd/efgh/index.html')
    await page.getByRole('button', { name: 'הבא עמודים' }).click()
    await expect(page.getByText('2 עמודים התקבלו מהכתובת')).toBeVisible({ timeout: 20_000 })
  })
})

test.describe('flipbook addresses', () => {
  const cases: Array<[string, string | null]> = [
    ['https://fliphtml5.com/abcd/efgh/', 'abcd/efgh'],
    ['https://fliphtml5.com/abcd/efgh', 'abcd/efgh'],
    ['https://online.fliphtml5.com/abcd/efgh/index.html', 'abcd/efgh'],
    ['https://fliphtml5.com/abcd/efgh/index.html?page=4', 'abcd/efgh'],
    ['  https://fliphtml5.com/abcd/efgh/  ', 'abcd/efgh'],
    ['https://example.com/abcd/efgh/', null],
    ['https://fliphtml5.com/abcd/', null],
    ['not a url', null],
  ]
  for (const [input, expected] of cases) {
    test(`reads ${JSON.stringify(input)}`, async () => {
      const parsed = parseFlipbookUrl(input)
      expect(parsed ? `${parsed.uid}/${parsed.bookId}` : null).toBe(expected)
    })
  }
})
