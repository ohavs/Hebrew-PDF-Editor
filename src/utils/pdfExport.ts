import { PDFDocument, StandardFonts, rgb, degrees, PDFName, PDFDict } from 'pdf-lib'
import type { Annotation, FormField, ImageAnnotation, PageInfo, Rect, Point } from '../store/types'
import type { PageNumberSettings } from '../store'
import { stampConfig, stampText, stampApplies, stampPosition, needsHebrewFont } from './pageStamp'
import { rasterizeTextBox, rasterizeStamp, rasterizeStickyCard, rasterizePlainText, rasterizeStampText } from './textRaster'

export interface ExportDecorations {
  watermark?: {
    text: string
    fontSize: number
    opacity: number
    dx: number
    dy: number
  } | null
  pageNumbers?: PageNumberSettings | null
}

/** Rasterize the watermark text (Hebrew-safe) as a square diagonal tile. */
function rasterizeWatermark(text: string, fontSize: number): { dataUrl: string; side: number } {
  const canvas = document.createElement('canvas')
  const S = 2
  canvas.width = 800 * S
  canvas.height = 800 * S
  const ctx = canvas.getContext('2d')!
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate(-Math.PI / 4)
  let fs = fontSize
  ctx.font = `bold ${fs * S}px Heebo, Arial`
  while (fs > 20 && ctx.measureText(text).width > 1050 * S) {
    fs -= 5
    ctx.font = `bold ${fs * S}px Heebo, Arial`
  }
  ctx.fillStyle = 'rgba(0,0,0,1)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 0, 0)
  return { dataUrl: canvas.toDataURL('image/png'), side: 800 }
}

/**
 * Draw a picture rotated (and rounded) onto a canvas sized to its rotated
 * bounding box, so the caller only has to place an upright rectangle.
 */
async function rasterizeImageObject(ann: ImageAnnotation): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = await loadImage(ann.imageData)
  const S = 2 // supersample so rotated edges stay clean
  const rad = (ann.rotation * Math.PI) / 180
  const w = ann.rect.width
  const h = ann.rect.height
  const bw = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad))
  const bh = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad))

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(bw * S))
  canvas.height = Math.max(1, Math.ceil(bh * S))
  const ctx = canvas.getContext('2d')!
  ctx.scale(S, S)
  ctx.translate(bw / 2, bh / 2)
  ctx.rotate(rad)
  if (ann.cornerRadius > 0) {
    const r = Math.min(ann.cornerRadius, w / 2, h / 2)
    ctx.beginPath()
    ctx.roundRect(-w / 2, -h / 2, w, h, r)
    ctx.clip()
  }
  ctx.drawImage(img, -w / 2, -h / 2, w, h)
  return { dataUrl: canvas.toDataURL('image/png'), width: bw, height: bh }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image decode failed'))
    img.src = src
  })
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return [r, g, b]
}

function parseColor(color: string): [number, number, number] {
  if (color.startsWith('#')) return hexToRgb(color)
  const m = color.match(/[\d.]+/g)
  if (m && m.length >= 3) {
    return [+m[0] / 255, +m[1] / 255, +m[2] / 255]
  }
  return [0, 0, 0]
}

/**
 * Coordinate mapping between display space and PDF page content space.
 *
 * Annotations are stored in natural display coordinates: CSS pixels at
 * zoom 1, origin top-left, on the page as DISPLAYED (i.e. after any
 * /Rotate). At scale 1 a pdf.js CSS pixel equals one PDF point, so no
 * scaling is needed — only the axis flip and, for rotated pages, the
 * inverse of the display rotation.
 *
 * R = total display rotation (intrinsic /Rotate + in-app delta), 0/90/180/270.
 * W, H = the UNROTATED page size in points (pdf-lib page.getSize()).
 */
export function pageMapper(R: number, W: number, H: number) {
  const rot = ((R % 360) + 360) % 360
  return {
    /** Map a display point (y down) to page space (y up). */
    point(p: Point): Point {
      switch (rot) {
        case 90:  return { x: p.y, y: p.x }
        case 180: return { x: W - p.x, y: p.y }
        case 270: return { x: W - p.y, y: H - p.x }
        default:  return { x: p.x, y: H - p.y }
      }
    },
    /** Map an axis-aligned display rect to a page-space rect (bottom-left anchored). */
    rect(r: Rect): Rect {
      switch (rot) {
        case 90:  return { x: r.y, y: r.x, width: r.height, height: r.width }
        case 180: return { x: W - r.x - r.width, y: r.y, width: r.width, height: r.height }
        case 270: return { x: W - r.y - r.height, y: H - r.x - r.width, width: r.height, height: r.width }
        default:  return { x: r.x, y: H - r.y - r.height, width: r.width, height: r.height }
      }
    },
    /**
     * Anchor + rotation for drawing an image so that it fills the display
     * rect upright in the rotated view. pdf-lib rotates around the anchor.
     */
    imagePlacement(r: Rect): { x: number; y: number; width: number; height: number; rotate: number } {
      switch (rot) {
        case 90:  return { x: r.y + r.height, y: r.x, width: r.width, height: r.height, rotate: 90 }
        case 180: return { x: W - r.x, y: r.y + r.height, width: r.width, height: r.height, rotate: 180 }
        case 270: return { x: W - r.y - r.height, y: H - r.x, width: r.width, height: r.height, rotate: 270 }
        default:  return { x: r.x, y: H - r.y - r.height, width: r.width, height: r.height, rotate: 0 }
      }
    },
  }
}

async function embedDataUrl(pdfDoc: PDFDocument, dataUrl: string) {
  const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0))
  return dataUrl.includes('image/png') ? pdfDoc.embedPng(bytes) : pdfDoc.embedJpg(bytes)
}

/**
 * Bake annotations + form values into the PDF, apply per-page rotations,
 * then rebuild the document in display order.
 */
export async function embedAnnotationsIntoPdf(
  pdfBytes: Uint8Array,
  annotations: Annotation[],
  formFields: FormField[],
  pageInfos: PageInfo[],
  pageOrder: number[],
  decorations?: ExportDecorations,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
  const pages = pdfDoc.getPages()

  // Per-page display rotation = intrinsic /Rotate + in-app delta
  const totalRotation = (idx: number) =>
    (((pages[idx].getRotation().angle + (pageInfos[idx]?.rotation || 0)) % 360) + 360) % 360

  for (const ann of annotations) {
    const pageIdx = ann.pageIndex
    if (pageIdx < 0 || pageIdx >= pages.length) continue
    const page = pages[pageIdx]
    const { width: W, height: H } = page.getSize()
    const map = pageMapper(totalRotation(pageIdx), W, H)

    try {
      if (ann.type === 'textbox') {
        const raster = rasterizeTextBox(ann)
        if (raster) {
          const img = await embedDataUrl(pdfDoc, raster.dataUrl)
          // A rotated box was drawn into the bounding box of its rotated form,
          // so it hangs off the corner — centre it on the box instead
          const displayRect: Rect = raster.rotated
            ? {
                x: ann.rect.x + ann.rect.width / 2 - raster.width / 2,
                y: ann.rect.y + ann.rect.height / 2 - raster.height / 2,
                width: raster.width, height: raster.height,
              }
            : { ...ann.rect, width: raster.width, height: raster.height }
          const place = map.imagePlacement(displayRect)
          page.drawImage(img, { ...place, rotate: degrees(place.rotate) })
        }
      } else if (ann.type === 'highlight' || ann.type === 'underline' || ann.type === 'strikethrough') {
        const [r, g, b] = parseColor(ann.color)
        // Compute the drawn strip in display space, then map it.
        let strip: Rect = ann.rect
        if (ann.type === 'underline') {
          strip = { x: ann.rect.x, y: ann.rect.y + ann.rect.height - 2, width: ann.rect.width, height: 2 }
        } else if (ann.type === 'strikethrough') {
          strip = { x: ann.rect.x, y: ann.rect.y + ann.rect.height / 2 - 1, width: ann.rect.width, height: 2 }
        }
        const rect = map.rect(strip)
        page.drawRectangle({
          ...rect,
          color: rgb(r, g, b),
          opacity: ann.type === 'highlight' ? ann.opacity : 1,
          borderWidth: 0,
        })
      } else if (ann.type === 'draw') {
        if (ann.points.length < 2) continue
        const [r, g, b] = parseColor(ann.color)
        for (let i = 1; i < ann.points.length; i++) {
          page.drawLine({
            start: map.point(ann.points[i - 1]),
            end: map.point(ann.points[i]),
            thickness: ann.strokeWidth,
            color: rgb(r, g, b),
            opacity: ann.opacity,
            lineCap: 1, // round
          })
        }
      } else if (ann.type === 'shape') {
        const [sr, sg, sb] = parseColor(ann.strokeColor)
        const hasFill = ann.fillColor !== 'transparent' && ann.fillColor !== ''
        const [fr, fg, fb] = hasFill ? parseColor(ann.fillColor) : [0, 0, 0]
        const rect = map.rect(ann.rect)

        if (ann.shape === 'rect') {
          page.drawRectangle({
            ...rect,
            borderColor: rgb(sr, sg, sb),
            borderWidth: ann.strokeWidth,
            opacity: hasFill ? ann.opacity : undefined,
            borderOpacity: ann.opacity,
            ...(hasFill ? { color: rgb(fr, fg, fb) } : {}),
          })
        } else if (ann.shape === 'ellipse') {
          page.drawEllipse({
            x: rect.x + rect.width / 2, y: rect.y + rect.height / 2,
            xScale: rect.width / 2, yScale: rect.height / 2,
            borderColor: rgb(sr, sg, sb),
            borderWidth: ann.strokeWidth,
            borderOpacity: ann.opacity,
            ...(hasFill ? { color: rgb(fr, fg, fb), opacity: ann.opacity } : {}),
          })
        } else if (ann.shape === 'line' || ann.shape === 'arrow') {
          // Display-space endpoints: bottom-left → top-right of the rect
          const p1 = map.point({ x: ann.rect.x, y: ann.rect.y + ann.rect.height })
          const p2 = map.point({ x: ann.rect.x + ann.rect.width, y: ann.rect.y })
          page.drawLine({
            start: p1, end: p2,
            thickness: ann.strokeWidth,
            color: rgb(sr, sg, sb),
            opacity: ann.opacity,
            lineCap: 1,
          })
          if (ann.shape === 'arrow') {
            const dx = p2.x - p1.x, dy = p2.y - p1.y
            const len = Math.hypot(dx, dy)
            if (len >= 4) {
              const headLen = Math.max(10, Math.min(24, len * 0.25))
              const angle = Math.atan2(dy, dx)
              const spread = 0.42
              const h1 = { x: p2.x - headLen * Math.cos(angle - spread), y: p2.y - headLen * Math.sin(angle - spread) }
              const h2 = { x: p2.x - headLen * Math.cos(angle + spread), y: p2.y - headLen * Math.sin(angle + spread) }
              page.drawLine({ start: p2, end: h1, thickness: ann.strokeWidth, color: rgb(sr, sg, sb), opacity: ann.opacity, lineCap: 1 })
              page.drawLine({ start: p2, end: h2, thickness: ann.strokeWidth, color: rgb(sr, sg, sb), opacity: ann.opacity, lineCap: 1 })
            }
          }
        }
      } else if (ann.type === 'stamp') {
        const raster = rasterizeStamp(ann)
        const img = await embedDataUrl(pdfDoc, raster.dataUrl)
        // Center the rotated AABB on the stamp rect's center
        const cx = ann.rect.x + ann.rect.width / 2
        const cy = ann.rect.y + ann.rect.height / 2
        const displayRect: Rect = {
          x: cx - raster.width / 2, y: cy - raster.height / 2,
          width: raster.width, height: raster.height,
        }
        const place = map.imagePlacement(displayRect)
        page.drawImage(img, { ...place, rotate: degrees(place.rotate) })
      } else if (ann.type === 'image') {
        // Unrotated, square-cornered pictures go in at full quality; the rest
        // are drawn through a canvas first, because compounding an object
        // rotation with the page's own rotation in pdf-lib's anchor model is
        // a source of subtle placement bugs.
        if (!ann.rotation && !ann.cornerRadius) {
          const img = await embedDataUrl(pdfDoc, ann.imageData)
          const place = map.imagePlacement(ann.rect)
          page.drawImage(img, { ...place, rotate: degrees(place.rotate), opacity: ann.opacity })
        } else {
          const raster = await rasterizeImageObject(ann)
          const img = await embedDataUrl(pdfDoc, raster.dataUrl)
          const cx = ann.rect.x + ann.rect.width / 2
          const cy = ann.rect.y + ann.rect.height / 2
          const displayRect: Rect = {
            x: cx - raster.width / 2, y: cy - raster.height / 2,
            width: raster.width, height: raster.height,
          }
          const place = map.imagePlacement(displayRect)
          page.drawImage(img, { ...place, rotate: degrees(place.rotate), opacity: ann.opacity })
        }
      } else if (ann.type === 'signature') {
        const img = await embedDataUrl(pdfDoc, ann.imageData)
        const place = map.imagePlacement(ann.rect)
        page.drawImage(img, { ...place, rotate: degrees(place.rotate) })
      } else if (ann.type === 'sticky') {
        const raster = rasterizeStickyCard(ann)
        if (raster) {
          const img = await embedDataUrl(pdfDoc, raster.dataUrl)
          const displayRect: Rect = {
            x: ann.position.x, y: ann.position.y,
            width: raster.width, height: raster.height,
          }
          const place = map.imagePlacement(displayRect)
          page.drawImage(img, { ...place, rotate: degrees(place.rotate) })
        }
      }
    } catch (e) {
      console.error('annotation export failed', ann.type, e)
    }
  }

  // Form field values (rasterized → Hebrew-safe)
  for (const field of formFields) {
    const pageIdx = field.pageIndex
    if (pageIdx < 0 || pageIdx >= pages.length) continue
    const page = pages[pageIdx]
    const { width: W, height: H } = page.getSize()
    const map = pageMapper(totalRotation(pageIdx), W, H)
    try {
      if (field.type === 'checkbox' || field.type === 'radio') {
        if (field.value !== true) continue
        // A tick sized to the box, centred — the widget it replaces is gone
        const side = Math.min(field.rect.width, field.rect.height)
        const raster = rasterizePlainText(field.type === 'radio' ? '●' : '✓', side * 0.8, '#000000', side * 2)
        if (!raster) continue
        const img = await embedDataUrl(pdfDoc, raster.dataUrl)
        const displayRect: Rect = {
          x: field.rect.x + (field.rect.width - raster.width) / 2,
          y: field.rect.y + (field.rect.height - raster.height) / 2,
          width: raster.width, height: raster.height,
        }
        const place = map.imagePlacement(displayRect)
        page.drawImage(img, { ...place, rotate: degrees(place.rotate) })
        continue
      }

      if (!field.value || typeof field.value !== 'string') continue
      const text = String(field.value)
      const raster = rasterizePlainText(text, 12, '#000000', field.rect.width - 8)
      if (raster) {
        const img = await embedDataUrl(pdfDoc, raster.dataUrl)
        // Hebrew reads from the right edge of the box, like the form does
        const rtl = /[֐-׿]/.test(text)
        const displayRect: Rect = {
          x: rtl
            ? field.rect.x + field.rect.width - 4 - raster.width
            : field.rect.x + 4,
          y: field.rect.y + (field.rect.height - raster.height) / 2,
          width: raster.width, height: raster.height,
        }
        const place = map.imagePlacement(displayRect)
        page.drawImage(img, { ...place, rotate: degrees(place.rotate) })
      }
    } catch (e) { console.error('form field export failed', e) }
  }

  // The values above are page content, and a viewer paints a widget's own
  // appearance stream on top of that — an empty text field would simply
  // cover what was typed. Flatten by dropping the widgets and the AcroForm.
  if (formFields.some(f => f.pdfFieldRef)) {
    try {
      pdfDoc.catalog.delete(PDFName.of('AcroForm'))
      for (const page of pages) {
        const annots = page.node.Annots()
        if (!annots) continue
        for (let i = annots.size() - 1; i >= 0; i--) {
          const entry = page.node.context.lookup(annots.get(i))
          if (entry instanceof PDFDict && String(entry.get(PDFName.of('Subtype'))) === '/Widget') {
            annots.remove(i)
          }
        }
      }
    } catch (e) { console.error('form flatten failed', e) }
  }

  // Live decorations — watermark + page numbers on every page
  if (decorations?.watermark?.text?.trim()) {
    const wm = decorations.watermark
    try {
      const raster = rasterizeWatermark(wm.text, wm.fontSize)
      const img = await embedDataUrl(pdfDoc, raster.dataUrl)
      pages.forEach((page, idx) => {
        const { width: W, height: H } = page.getSize()
        const R = totalRotation(idx)
        const [dw, dh] = R % 180 === 90 ? [H, W] : [W, H]
        const side = Math.min(dw, dh) * 0.8
        const displayRect: Rect = {
          x: (dw - side) / 2 + wm.dx,
          y: (dh - side) / 2 + wm.dy,
          width: side, height: side,
        }
        const map = pageMapper(R, W, H)
        const place = map.imagePlacement(displayRect)
        page.drawImage(img, { ...place, rotate: degrees(place.rotate), opacity: wm.opacity })
      })
    } catch (e) { console.error('watermark export failed', e) }
  }

  if (decorations?.pageNumbers) {
    const pn = decorations.pageNumbers
    try {
      const cfg = stampConfig(pn)
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const total = pageOrder.length || pages.length
      const now = new Date()

      for (const [idx, page] of pages.entries()) {
        const { width: W, height: H } = page.getSize()
        const R = totalRotation(idx)
        const [dw, dh] = R % 180 === 90 ? [H, W] : [W, H]
        // Number by DISPLAY position so it matches what the user sees
        const displayPos = pageOrder.length ? pageOrder.indexOf(idx) : idx
        if (displayPos < 0) continue
        if (!stampApplies(pn, displayPos, total)) continue

        const label = stampText(pn, displayPos, total, now)
        if (!label.trim()) continue
        const map = pageMapper(R, W, H)

        if (needsHebrewFont(label)) {
          // A built-in font cannot encode Hebrew, so the text is drawn the
          // same way every other Hebrew string in this app is: as artwork
          const tile = rasterizeStampText(label, cfg.fontSize, cfg.color, cfg.bold, cfg.fontFamily)
          const at = stampPosition(pn, dw, dh, tile.width)
          const place = map.imagePlacement({
            x: at.x, y: at.y - cfg.fontSize, width: tile.width, height: tile.height,
          })
          const img = await pdfDoc.embedPng(tile.dataUrl)
          page.drawImage(img, {
            x: place.x, y: place.y, width: place.width, height: place.height,
            rotate: degrees(place.rotate),
          })
          continue
        }

        const textW = font.widthOfTextAtSize(label, cfg.fontSize)
        const at = stampPosition(pn, dw, dh, textW)
        const place = map.imagePlacement({
          x: at.x, y: at.y - cfg.fontSize, width: textW, height: cfg.fontSize,
        })
        const [r, g, b] = hexToRgb(cfg.color)
        page.drawText(label, {
          x: place.x, y: place.y + 2,
          size: cfg.fontSize, font, color: rgb(r, g, b),
          rotate: degrees(place.rotate),
        })
      }
    } catch (e) { console.error('page numbers export failed', e) }
  }

  // Bake in-app page rotations so viewers show what the user saw
  pages.forEach((page, idx) => {
    const delta = pageInfos[idx]?.rotation || 0
    if (delta) page.setRotation(degrees(totalRotation(idx)))
  })

  // Apply display order — rebuild if the order isn't the identity
  const isIdentity = pageOrder.length === 0 || pageOrder.every((n, i) => n === i)
  if (isIdentity) return pdfDoc.save()

  const ordered = await PDFDocument.create()
  const validOrder = pageOrder.filter(n => n >= 0 && n < pages.length)
  const copied = await ordered.copyPages(pdfDoc, validOrder)
  copied.forEach(p => ordered.addPage(p))
  return ordered.save()
}

export function downloadBlob(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
  triggerDownload(blob, filename)
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Share via the native share sheet when available; falls back to download. */
export async function shareOrDownload(bytes: Uint8Array, filename: string): Promise<'shared' | 'downloaded'> {
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
  const file = new File([blob], filename, { type: 'application/pdf' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return 'shared'
    } catch (e: any) {
      if (e?.name === 'AbortError') return 'shared' // user cancelled the sheet
    }
  }
  triggerDownload(blob, filename)
  return 'downloaded'
}
