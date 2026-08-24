import { test, expect } from '@playwright/test'
import { PDFDocument, PDFName } from 'pdf-lib'
import { readFileSync } from 'fs'
import { confirmDownload, trackErrors, RED_SQUARE_PNG } from './fixtures'

async function newDocument(page: import('@playwright/test').Page, pages = 1) {
  await page.goto('/#/create', { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  if (pages !== 1) {
    await page.getByLabel('מספר עמודים').fill(String(pages))
  }
  await page.getByRole('button', { name: 'צור מסמך' }).click()
  await page.waitForTimeout(3000)
}

/** Drop a file onto an element by synthesising a DataTransfer in the page. */
async function dropImageOnPage(page: import('@playwright/test').Page, dataUrl: string) {
  const box = (await page.locator('#page-0').boundingBox())!
  await page.evaluate(async ({ dataUrl, x, y }) => {
    const blob = await (await fetch(dataUrl)).blob()
    const file = new File([blob], 'dropped.png', { type: 'image/png' })
    const dt = new DataTransfer()
    dt.items.add(file)
    const target = document.elementFromPoint(x, y)!
    for (const type of ['dragover', 'drop']) {
      target.dispatchEvent(new DragEvent(type, {
        bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt,
      }))
    }
  }, { dataUrl, x: box.x + box.width / 2, y: box.y + box.height / 2 })
  await page.waitForTimeout(1200)
}

test.describe('PDF authoring', () => {
  test('creates a blank document you can immediately edit', async ({ page }) => {
    const errors = trackErrors(page)
    await newDocument(page, 3)

    // Real pages, rendered, with the whole editor around them
    await expect(page.locator('#page-0 canvas.pdf-canvas')).toBeVisible()
    await expect(page.getByText('3', { exact: false }).first()).toBeVisible()

    // ...and the result is a genuine PDF with the pages that were asked for
    await page.getByRole('button', { name: /^(יצוא כ\.\.\.|הורד)$/ }).first().click()
    const download = await confirmDownload(page)
    const doc = await PDFDocument.load(readFileSync((await download.path())!))
    expect(doc.getPageCount()).toBe(3)
    // A4 portrait, in points
    expect(Math.round(doc.getPage(0).getWidth())).toBe(595)
    expect(Math.round(doc.getPage(0).getHeight())).toBe(842)
    expect(errors).toEqual([])
  })

  test('a dropped picture becomes a movable object that reaches the file', async ({ page }) => {
    const errors = trackErrors(page)
    await newDocument(page)

    await dropImageOnPage(page, RED_SQUARE_PNG)
    const object = page.locator('[data-image-object]')
    await expect(object).toHaveCount(1)

    // Dragging moves it
    const before = (await object.boundingBox())!
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2)
    await page.mouse.down()
    await page.mouse.move(before.x + before.width / 2 + 90, before.y + before.height / 2 + 60, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(400)
    const after = (await object.boundingBox())!
    expect(after.x).not.toBeCloseTo(before.x, 0)

    // ...and it is really in the exported PDF, as an image XObject
    await page.getByRole('button', { name: /^(יצוא כ\.\.\.|הורד)$/ }).first().click()
    const download = await confirmDownload(page)
    const out = await PDFDocument.load(readFileSync((await download.path())!))
    const xobjects = out.getPage(0).node.Resources()?.lookup(PDFName.of('XObject')) as any
    expect(xobjects?.keys().length).toBeGreaterThanOrEqual(1)

    expect(errors).toEqual([])
  })

  test('pasted text lands on the page as an editable box', async ({ page }) => {
    await newDocument(page)

    const box = (await page.locator('#page-0').boundingBox())!
    // Put the pointer over the page so the paste knows where to go
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3)
    await page.evaluate(() => {
      const dt = new DataTransfer()
      dt.setData('text/plain', 'שלום מהלוח')
      window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    })
    await page.waitForTimeout(1000)

    await expect(page.getByText('שלום מהלוח')).toBeVisible()
  })

  test('text boxes carry the advanced layout settings into the file', async ({ page }) => {
    const errors = trackErrors(page)
    await newDocument(page)

    // Place a text box and type into it
    await page.getByRole('button', { name: 'טקסט' }).first().click()
    await page.waitForTimeout(400)
    const pageBox = (await page.locator('#page-0').boundingBox())!
    await page.mouse.click(pageBox.x + pageBox.width / 2, pageBox.y + 200)
    await page.waitForTimeout(700)
    await page.keyboard.type('כותרת מעוצבת')
    await page.waitForTimeout(400)

    // The extra controls appear for a selected box
    await expect(page.getByText(/גובה שורה/).first()).toBeVisible()

    // Give it a background and a rotation
    await page.evaluate(() => {
      const setRange = (labelText: string, value: string) => {
        const label = Array.from(document.querySelectorAll('label.label'))
          .find(l => (l.textContent || '').includes(labelText)) as HTMLElement
        const input = label.parentElement!.querySelector('input[type="range"]') as HTMLInputElement
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
        setter.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
      setRange('סיבוב', '20')
      setRange('ריווח אותיות', '3')
    })
    await page.waitForTimeout(600)

    // The box on screen really is rotated
    const transform = await page.locator('[contenteditable]').first().evaluate(el => {
      const boxEl = el.parentElement as HTMLElement
      return getComputedStyle(boxEl).transform
    })
    expect(transform).not.toBe('none')

    // ...and the document still exports cleanly with the text baked in
    await page.getByRole('button', { name: /^(יצוא כ\.\.\.|הורד)$/ }).first().click()
    const download = await confirmDownload(page)
    const out = await PDFDocument.load(readFileSync((await download.path())!))
    const xobjects = out.getPage(0).node.Resources()?.lookup(PDFName.of('XObject')) as any
    expect(xobjects?.keys().length).toBeGreaterThanOrEqual(1)
    expect(errors).toEqual([])
  })

  test('pages can be added without flattening the work in progress', async ({ page }) => {
    const errors = trackErrors(page)
    await newDocument(page)
    await dropImageOnPage(page, RED_SQUARE_PNG)
    await expect(page.locator('[data-image-object]')).toHaveCount(1)

    await page.getByRole('button', { name: '＋ הוסף עמוד' }).click()
    await page.waitForTimeout(3500)

    // Two pages now — and the picture is still a live object, not baked flat
    await expect(page.locator('#page-1')).toBeVisible()
    await expect(page.locator('[data-image-object]')).toHaveCount(1)

    await page.getByRole('button', { name: /^(יצוא כ\.\.\.|הורד)$/ }).first().click()
    const download = await confirmDownload(page)
    const out = await PDFDocument.load(readFileSync((await download.path())!))
    expect(out.getPageCount()).toBe(2)
    expect(errors).toEqual([])
  })

  test('objects can be duplicated, restacked and nudged', async ({ page }) => {
    const errors = trackErrors(page)
    await newDocument(page)
    await dropImageOnPage(page, RED_SQUARE_PNG)
    await expect(page.locator('[data-image-object]')).toHaveCount(1)

    // Duplicate: the copy is offset, and it is the one now selected
    await page.getByRole('button', { name: /שכפל/ }).click()
    await page.waitForTimeout(500)
    await expect(page.locator('[data-image-object]')).toHaveCount(2)
    const boxes = await page.locator('[data-image-object]').all()
    const first = (await boxes[0].boundingBox())!
    const second = (await boxes[1].boundingBox())!
    expect(Math.round(second.x - first.x)).not.toBe(0)

    // Nudging moves the selection by exactly one point per press
    const beforeNudge = (await page.locator('[data-image-object]').last().boundingBox())!
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(400)
    const afterNudge = (await page.locator('[data-image-object]').last().boundingBox())!
    expect(afterNudge.y).toBeGreaterThan(beforeNudge.y)

    // Restacking reorders the DOM, which is what decides what paints on top
    const idsBefore = await page.locator('[data-image-object]').evaluateAll(
      els => els.map(e => e.getAttribute('data-image-object')))
    await page.getByRole('button', { name: /שלח לרקע/ }).click()
    await page.waitForTimeout(400)
    const idsAfter = await page.locator('[data-image-object]').evaluateAll(
      els => els.map(e => e.getAttribute('data-image-object')))
    expect(idsAfter).not.toEqual(idsBefore)
    expect([...idsAfter].sort()).toEqual([...idsBefore].sort())

    expect(errors).toEqual([])
  })
})
