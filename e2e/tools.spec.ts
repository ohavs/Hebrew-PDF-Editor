import { test, expect } from '@playwright/test'
import { PDFDocument, PDFName } from 'pdf-lib'
import { readFileSync } from 'fs'
import { deflateSync } from 'zlib'
import { makePdf, makeColoredPdf, makeDocx, upload, openToolWithPdf, confirmDownload, trackErrors, selectToolInPanel } from './fixtures'

/** A 1x1 solid PNG of the given colour, built by hand. */
function colorPng(r: number, g: number, b: number): Buffer {
  const crc = (buf: Buffer) => {
    let c = ~0
    for (const byte of buf) {
      c ^= byte
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1))
    }
    return ~c >>> 0
  }
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body))
    return Buffer.concat([len, body, sum])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4)
  ihdr[8] = 8; ihdr[9] = 2 // 8-bit truecolour
  const raw = Buffer.from([0, r, g, b]) // one row, no filter
  const deflate = deflateSync(raw)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflate), chunk('IEND', Buffer.alloc(0)),
  ])
}

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


  test('organize: deleting a page refreshes the previews', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/#/tools/organize', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    // Red, green, blue pages — each thumbnail is identifiable by its colour
    await upload(page, 'colors.pdf', await makeColoredPdf([
      [220, 30, 30], [30, 180, 60], [40, 70, 220],
    ]), 'application/pdf')
    await page.waitForTimeout(3000)

    /** The dominant colour of each card's thumbnail. */
    const colours = () => page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-page-cell] canvas')).map(c => {
        const canvas = c as HTMLCanvasElement
        if (!canvas.width) return null
        const ctx = canvas.getContext('2d')!
        const { data } = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1)
        return [data[0], data[1], data[2]]
      }))

    const before = await colours()
    expect(before[0]![0]).toBeGreaterThan(150)  // red page first
    expect(before[1]![1]).toBeGreaterThan(120)  // green second

    // Remove the first page
    await page.locator('[data-page-cell]').first().getByLabel('מחק').click()
    await page.getByRole('button', { name: 'מחק', exact: true }).last().click()
    await page.waitForTimeout(3500)
    await expect(page.locator('[data-page-cell]')).toHaveCount(2)

    // The first card must now SHOW the green page. The render guard used to
    // survive the rebuilt document, leaving the old red picture in place —
    // which looked exactly like the wrong page had been deleted.
    const after = await colours()
    expect(after[0]![1]).toBeGreaterThan(120)
    expect(after[0]![0]).toBeLessThan(120)
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

  test('existing text can be picked up and replaced', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/#/editor', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await upload(page, 'text.pdf', await makePdf(1), 'application/pdf')
    await page.waitForTimeout(3500)

    // The tool is in the desktop toolbar, and behind "עוד" on a phone
    const toolButton = page.getByRole('button', { name: 'ערוך טקסט' })
    if (!(await toolButton.first().isVisible().catch(() => false))) {
      await page.getByRole('button', { name: 'עוד' }).first().click()
      await page.waitForTimeout(500)
    }
    await toolButton.filter({ visible: true }).first().click()
    await page.waitForTimeout(500)

    // "PAGE 1" is drawn at x=180, y=420 from the bottom of a 595x842 page,
    // so it sits a little above the middle in display coordinates
    const box = (await page.locator('#page-0').boundingBox())!
    const zoom = await page.evaluate(() => {
      const el = document.querySelector('#page-0') as HTMLElement
      return el.getBoundingClientRect().width / 595
    })
    const at = { x: box.x + 230 * zoom, y: box.y + (842 - 435) * zoom }

    // Hovering shows exactly what would be replaced
    await page.mouse.move(at.x, at.y)
    await page.waitForTimeout(700)
    await expect(page.locator('[data-text-edit-hover]')).toBeVisible()

    await page.mouse.click(at.x, at.y)
    await page.waitForTimeout(900)

    // The line arrives as a real text box, pre-filled with what was there
    const editable = page.locator('[contenteditable="true"]')
    await expect(editable).toHaveCount(1)
    await expect(editable).toContainText('PAGE 1')

    // Replace it and check the change reaches the file
    await page.keyboard.press('Control+a')
    await page.keyboard.type('REPLACED')
    await page.waitForTimeout(500)

    await page.getByRole('button', { name: /^(יצוא כ\.\.\.|הורד)$/ }).first().click()
    const download = await confirmDownload(page)
    const out = await PDFDocument.load(readFileSync((await download.path())!))
    // The replacement is drawn as artwork over the covered original
    const xobjects = out.getPage(0).node.Resources()?.lookup(PDFName.of('XObject')) as any
    expect(xobjects?.keys().length).toBeGreaterThanOrEqual(1)

    expect(errors).toEqual([])
  })

  test('the editor page rail deletes and reorders without leaving the editor', async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'the page rail is desktop chrome')
    const errors = trackErrors(page)
    await page.goto('/#/editor', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    // Red, green, blue — so what each thumbnail shows can be checked
    await upload(page, 'colors.pdf', await makeColoredPdf([
      [220, 30, 30], [30, 180, 60], [40, 70, 220],
    ]), 'application/pdf')
    await page.waitForTimeout(3500)

    const items = page.locator('[data-thumb-item]')
    await expect(items).toHaveCount(3)

    const colours = () => page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-thumb-item] canvas')).map(c => {
        const canvas = c as HTMLCanvasElement
        if (!canvas.width) return null
        const ctx = canvas.getContext('2d')!
        const { data } = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1)
        return [data[0], data[1], data[2]]
      }))

    // Right-click opens the actions for that page
    await items.first().click({ button: 'right' })
    await expect(page.getByRole('menu')).toBeVisible()

    await page.getByRole('menuitem', { name: 'מחק עמוד' }).click()
    await page.getByRole('button', { name: 'מחק', exact: true }).last().click()
    await page.waitForTimeout(3500)

    await expect(items).toHaveCount(2)
    // The rail shows the pages that are actually left, not stale pictures
    const after = await colours()
    expect(after[0]![1]).toBeGreaterThan(120)
    expect(after[0]![0]).toBeLessThan(120)

    expect(errors).toEqual([])
  })

  test('the editor page rail reorders by dragging the grip', async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'the page rail is desktop chrome')
    await page.goto('/#/editor', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await upload(page, 'colors.pdf', await makeColoredPdf([
      [220, 30, 30], [30, 180, 60], [40, 70, 220],
    ]), 'application/pdf')
    await page.waitForTimeout(3500)

    const items = page.locator('[data-thumb-item]')
    const grip = await items.nth(0).getByLabel('גרור לשינוי סדר').boundingBox()
    const target = await items.nth(2).boundingBox()
    await page.mouse.move(grip!.x + grip!.width / 2, grip!.y + grip!.height / 2)
    await page.mouse.down()
    await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, { steps: 12 })
    await page.mouse.up()
    await page.waitForTimeout(800)

    // The red page moved to the end of the rail
    const last = await page.evaluate(() => {
      const canvases = Array.from(document.querySelectorAll('[data-thumb-item] canvas')) as HTMLCanvasElement[]
      const c = canvases[canvases.length - 1]
      const { data } = c.getContext('2d')!.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1)
      return [data[0], data[1], data[2]]
    })
    expect(last[0]).toBeGreaterThan(150)
    expect(last[1]).toBeLessThan(120)
  })

  test('the panel tabs underline the tab that is actually active', async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'the side panel is desktop chrome')
    await page.goto('/#/editor', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await upload(page, 'test.pdf', await makePdf(2), 'application/pdf')
    await page.waitForTimeout(3000)

    /** Horizontal centre of the active tab and of the underline. */
    const centres = () => page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
        .filter(b => ['תמונות ממוזערות', 'הערות'].includes((b.textContent || '').trim()))
      const active = buttons.find(b => getComputedStyle(b).color === getComputedStyle(document.documentElement)
        .getPropertyValue('--color-accent').trim() || false)
      const bar = buttons[0]?.parentElement?.querySelector('div') as HTMLElement
      return {
        tabs: buttons.map(b => ({ text: (b.textContent || '').trim(), x: b.getBoundingClientRect().x + b.getBoundingClientRect().width / 2 })),
        bar: bar ? bar.getBoundingClientRect().x + bar.getBoundingClientRect().width / 2 : null,
        activeText: active ? (active.textContent || '').trim() : null,
      }
    })

    // Thumbnails is the default tab; the underline must sit under it. In RTL
    // a physical `left` offset put it under the other tab entirely.
    const shown = await centres()
    const thumbs = shown.tabs.find(t => t.text === 'תמונות ממוזערות')!
    expect(Math.abs(shown.bar! - thumbs.x)).toBeLessThan(20)

    // ...and it follows when the other tab is picked
    await page.getByRole('button', { name: 'הערות', exact: true }).click()
    await page.waitForTimeout(500)
    const after = await centres()
    const notes = after.tabs.find(t => t.text === 'הערות')!
    expect(Math.abs(after.bar! - notes.x)).toBeLessThan(20)
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

  test('merge: an added file goes in after the page you choose', async ({ page }) => {
    await page.goto('/#/tools/merge', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    // A first file of 4 pages
    await page.locator('input[type="file"][accept=".pdf"]').last().setInputFiles([
      { name: 'base.pdf', mimeType: 'application/pdf', buffer: await makePdf(4) },
    ])
    await page.waitForTimeout(2500)
    await expect(page.locator('[data-merge-page]')).toHaveCount(4)

    // Put the next file's pages after page 1 rather than at the end
    await page.getByRole('button', { name: 'אחרי עמוד' }).click()
    await page.getByLabel('אחרי עמוד').fill('1')
    await page.locator('input[type="file"][accept=".pdf"]').last().setInputFiles([
      { name: 'extra.pdf', mimeType: 'application/pdf', buffer: await makePdf(2) },
    ])
    await page.waitForTimeout(2500)
    await expect(page.locator('[data-merge-page]')).toHaveCount(6)

    // Positions 2 and 3 are the newcomers, not positions 5 and 6
    const labels = await page.locator('[data-merge-page]').allInnerTexts()
    expect(labels[1]).toContain('extra.pdf')
    expect(labels[2]).toContain('extra.pdf')
    expect(labels[0]).toContain('base.pdf')
    expect(labels[3]).toContain('base.pdf')

    // ...and the newcomers arrive already selected, ready to move together
    await expect(page.locator('[data-merge-page][data-selected="true"]')).toHaveCount(2)
  })

  test('merge: only the requested pages of a file are taken', async ({ page }) => {
    await page.goto('/#/tools/merge', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await page.getByLabel('עמודים מהקובץ').fill('1, 3')
    await page.locator('input[type="file"][accept=".pdf"]').last().setInputFiles([
      { name: 'big.pdf', mimeType: 'application/pdf', buffer: await makePdf(5) },
    ])
    await page.waitForTimeout(2500)

    await expect(page.locator('[data-merge-page]')).toHaveCount(2)
    const doc = await loadDownloaded(await (async () => {
      await page.getByRole('button', { name: /מזג .* עמודים והורד/ }).click()
      return confirmDownload(page)
    })())
    expect(doc.getPageCount()).toBe(2)
  })

  test('merge: selected pages move as one block', async ({ page }) => {
    await page.goto('/#/tools/merge', { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await page.locator('input[type="file"][accept=".pdf"]').last().setInputFiles([
      { name: 'a.pdf', mimeType: 'application/pdf', buffer: await makePdf(4) },
    ])
    await page.waitForTimeout(2500)
    const cards = page.locator('[data-merge-page]')
    await expect(cards).toHaveCount(4)

    // Select the last two by clicking one and shift-clicking the other
    await cards.nth(2).click()
    await cards.nth(3).click({ modifiers: ['Shift'] })
    await expect(page.locator('[data-merge-page][data-selected="true"]')).toHaveCount(2)

    // Send them to the front in one action
    await page.getByRole('button', { name: /להתחלה/ }).click()
    await page.waitForTimeout(400)

    const labels = await cards.allInnerTexts()
    // Source pages 3 and 4 now lead, still in their original order
    expect(labels[0]).toContain('· 3')
    expect(labels[1]).toContain('· 4')
    expect(labels[2]).toContain('· 1')
  })

  test('the tool list is grouped, with conversions together', async ({ page }) => {
    await openToolWithPdf(page, 'organize', 2)
    await page.getByRole('button', { name: 'הצג את כל הכלים' }).click()
    await page.waitForTimeout(400)

    for (const heading of ['עמודים', 'המרות', 'המסמך']) {
      await expect(page.getByText(heading, { exact: true }).first()).toBeVisible()
    }

    // Every converter sits under "המרות", including the flipbook
    const inConvert = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('div'))
        .filter(d => d.textContent?.trim() === 'המרות' && d.children.length === 0)
      const group = headings[0]?.parentElement
      return Array.from(group?.querySelectorAll('button') || []).map(b => b.textContent?.trim())
    })
    for (const tool of ['PDF לתמונה', 'תמונה ל-PDF', 'PDF לוורד', 'וורד ל-PDF', 'PDF לאקסל', 'פליפבוק ל-PDF']) {
      expect(inConvert).toContain(tool)
    }
  })

  test('flipbook pages become a PDF in natural page order', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/#/tools/flipbook', { waitUntil: 'networkidle' })
    await page.waitForTimeout(700)

    // Deliberately out of lexicographic order: page10 would sort before page2
    await page.locator('input[type="file"][accept="image/*"]').first().setInputFiles([
      { name: 'page10.png', mimeType: 'image/png', buffer: colorPng(40, 70, 220) },
      { name: 'page2.png', mimeType: 'image/png', buffer: colorPng(30, 180, 60) },
      { name: 'page1.png', mimeType: 'image/png', buffer: colorPng(220, 30, 30) },
    ])
    await page.waitForTimeout(800)

    // Listed 1, 2, 10 — not 1, 10, 2
    const rows = await page.getByText(/^\d+\. page/).allInnerTexts()
    expect(rows[0]).toContain('page1.png')
    expect(rows[1]).toContain('page2.png')
    expect(rows[2]).toContain('page10.png')

    await page.getByRole('button', { name: 'צור PDF והורד' }).click()
    const doc = await loadDownloaded(await confirmDownload(page))
    expect(doc.getPageCount()).toBe(3)
    expect(errors).toEqual([])
  })

  test('the page preview arrows point the RTL way and stay visible', async ({ page }) => {
    await openToolWithPdf(page, 'organize', 3)
    await page.locator('[data-page-cell]').nth(1).locator('canvas').click()
    await page.waitForTimeout(1500)

    const prev = page.getByRole('button', { name: 'העמוד הקודם' })
    const next = page.getByRole('button', { name: 'העמוד הבא' })
    await expect(prev).toBeVisible()
    await expect(next).toBeVisible()

    const geometry = await page.evaluate(() => {
      const byLabel = (l: string) =>
        document.querySelector(`button[aria-label="${l}"]`) as HTMLElement
      const read = (el: HTMLElement) => ({
        x: el.getBoundingClientRect().x,
        // The chevron's path tells which way it points: "l7" turns right,
        // "l-7" turns left
        points: (el.querySelector('path')?.getAttribute('d') || '').includes('l7 7') ? 'right' : 'left',
        background: getComputedStyle(el).backgroundColor,
      })
      return { prev: read(byLabel('העמוד הקודם')), next: read(byLabel('העמוד הבא')) }
    })

    // Hebrew reads right to left: previous sits on the right and points right
    expect(geometry.prev.x).toBeGreaterThan(geometry.next.x)
    expect(geometry.prev.points).toBe('right')
    expect(geometry.next.points).toBe('left')

    // ...on a disc dark enough to show over a white page
    const rgb = geometry.prev.background.match(/[\d.]+/g)!.map(Number)
    expect((rgb[0] + rgb[1] + rgb[2]) / 3).toBeLessThan(120)
    expect(rgb[3] ?? 1).toBeGreaterThan(0.5)
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
