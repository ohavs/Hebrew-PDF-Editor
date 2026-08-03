import { test, expect } from '@playwright/test'
import { unzipSync, strFromU8 } from 'fflate'
import { readFileSync } from 'fs'
import { makeTablePdf, upload, trackErrors } from './fixtures'

const ROWS = [
  ['Item', 'Qty', 'Price'],
  ['Pen', '3', '12'],
  ['Book', '1', '45'],
]

test.describe('PDF → Excel', () => {
  test('recovers the table into a real workbook', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/#/tools/to-excel', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await upload(page, 'table.pdf', await makeTablePdf(ROWS), 'application/pdf')
    await page.waitForTimeout(2500)

    await page.getByRole('button', { name: 'המר ל-Excel והורד' }).click()
    await page.waitForTimeout(600)
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 25_000 }),
      page.getByRole('button', { name: 'הורד', exact: true }).last().click(),
    ])

    const buf = readFileSync((await download.path())!)
    expect(buf[0]).toBe(0x50) // 'P' — it is a zip
    expect(buf[1]).toBe(0x4b) // 'K'

    const files = unzipSync(new Uint8Array(buf))
    expect(Object.keys(files)).toContain('xl/workbook.xml')
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml'])

    // Every cell of the source grid survives, in its own cell
    for (const row of ROWS) {
      for (const cell of row) {
        expect(sheet, `cell "${cell}" missing`).toContain(`>${cell}<`)
      }
    }
    // Three columns means three distinct column letters on the first row
    expect(sheet).toContain('r="A1"')
    expect(sheet).toContain('r="B1"')
    expect(sheet).toContain('r="C1"')

    expect(errors).toEqual([])
  })
})
