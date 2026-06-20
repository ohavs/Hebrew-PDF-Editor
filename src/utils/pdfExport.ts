import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib'
import type { Annotation, FormField, PageInfo } from '../store/types'

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return [r, g, b]
}

function parseColor(color: string): [number, number, number] {
  if (color.startsWith('#')) return hexToRgb(color)
  // rgba/rgb
  const m = color.match(/[\d.]+/g)
  if (m && m.length >= 3) {
    return [+m[0]/255, +m[1]/255, +m[2]/255]
  }
  return [0, 0, 0]
}

export async function embedAnnotationsIntoPdf(
  pdfBytes: Uint8Array,
  annotations: Annotation[],
  formFields: FormField[],
  pageInfos: PageInfo[],
  pageOrder: number[],
  flatten: boolean = false
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
  const pages = pdfDoc.getPages()

  // Apply page order (reordering)
  // Note: pdf-lib doesn't directly support reordering easily, so we rebuild
  // For now just embed annotations onto existing pages

  for (const ann of annotations) {
    const pageIdx = ann.pageIndex
    if (pageIdx >= pages.length) continue
    const page = pages[pageIdx]
    const { width, height } = page.getSize()
    const info = pageInfos[pageIdx]
    const scaleX = width / (info?.width || width)
    const scaleY = height / (info?.height || height)

    if (ann.type === 'textbox') {
      const tb = ann
      const x = tb.rect.x * scaleX
      const y = height - (tb.rect.y + tb.rect.height) * scaleY
      try {
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
        const [r, g, b] = parseColor(tb.color)
        page.drawText(tb.content || '', {
          x, y,
          size: tb.fontSize,
          font,
          color: rgb(r, g, b),
          maxWidth: tb.rect.width * scaleX
        })
      } catch { /* skip */ }
    }

    if (ann.type === 'highlight') {
      const hl = ann
      const x = hl.rect.x * scaleX
      const y = height - (hl.rect.y + hl.rect.height) * scaleY
      const w = hl.rect.width * scaleX
      const h = hl.rect.height * scaleY
      const [r, g, b] = parseColor(hl.color)
      page.drawRectangle({
        x, y, width: w, height: h,
        color: rgb(r, g, b),
        opacity: hl.opacity,
        borderWidth: 0
      })
    }

    if (ann.type === 'draw') {
      const dr = ann
      if (dr.points.length < 2) continue
      const [r, g, b] = parseColor(dr.color)
      for (let i = 1; i < dr.points.length; i++) {
        page.drawLine({
          start: {
            x: dr.points[i-1].x * scaleX,
            y: height - dr.points[i-1].y * scaleY
          },
          end: {
            x: dr.points[i].x * scaleX,
            y: height - dr.points[i].y * scaleY
          },
          thickness: dr.strokeWidth,
          color: rgb(r, g, b),
          opacity: dr.opacity
        })
      }
    }

    if (ann.type === 'shape') {
      const sh = ann
      const x = sh.rect.x * scaleX
      const y = height - (sh.rect.y + sh.rect.height) * scaleY
      const w = sh.rect.width * scaleX
      const h = sh.rect.height * scaleY
      const [sr, sg, sb] = parseColor(sh.strokeColor)
      const hasFill = sh.fillColor !== 'transparent' && sh.fillColor !== ''
      const [fr, fg, fb] = hasFill ? parseColor(sh.fillColor) : [0,0,0]

      if (sh.shape === 'rect') {
        page.drawRectangle({
          x, y, width: w, height: h,
          borderColor: rgb(sr, sg, sb),
          borderWidth: sh.strokeWidth,
          ...(hasFill ? { color: rgb(fr, fg, fb) } : {})
        })
      } else if (sh.shape === 'ellipse') {
        page.drawEllipse({
          x: x + w/2, y: y + h/2,
          xScale: w/2, yScale: h/2,
          borderColor: rgb(sr, sg, sb),
          borderWidth: sh.strokeWidth,
          ...(hasFill ? { color: rgb(fr, fg, fb) } : {})
        })
      } else if (sh.shape === 'line' || sh.shape === 'arrow') {
        page.drawLine({
          start: { x, y: y + h },
          end: { x: x + w, y },
          thickness: sh.strokeWidth,
          color: rgb(sr, sg, sb)
        })
      }
    }

    if (ann.type === 'stamp') {
      const st = ann
      const x = st.rect.x * scaleX
      const y = height - (st.rect.y + st.rect.height) * scaleY
      const [r, g, b] = parseColor(st.color)
      try {
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
        page.drawText(st.text, {
          x, y: y + st.rect.height * scaleY / 2,
          size: st.fontSize,
          font,
          color: rgb(r, g, b),
          rotate: degrees(st.rotation),
          opacity: 0.7
        })
        // Draw border
        page.drawRectangle({
          x, y,
          width: st.rect.width * scaleX,
          height: st.rect.height * scaleY,
          borderColor: rgb(r, g, b),
          borderWidth: 2,
          opacity: 0.7
        })
      } catch { /* skip */ }
    }

    if (ann.type === 'signature') {
      const sig = ann
      try {
        const imgData = sig.imageData.split(',')[1]
        const imgBytes = Uint8Array.from(atob(imgData), c => c.charCodeAt(0))
        const img = sig.imageData.includes('png')
          ? await pdfDoc.embedPng(imgBytes)
          : await pdfDoc.embedJpg(imgBytes)
        const x = sig.rect.x * scaleX
        const y = height - (sig.rect.y + sig.rect.height) * scaleY
        page.drawImage(img, {
          x, y,
          width: sig.rect.width * scaleX,
          height: sig.rect.height * scaleY
        })
      } catch { /* skip */ }
    }
  }

  // Embed form field values as text
  for (const field of formFields) {
    if (!field.value) continue
    const pageIdx = field.pageIndex
    if (pageIdx >= pages.length) continue
    const page = pages[pageIdx]
    const { width, height } = page.getSize()
    const info = pageInfos[pageIdx]
    const scaleX = width / (info?.width || width)
    const scaleY = height / (info?.height || height)

    if (field.type === 'text' || field.type === 'date') {
      try {
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
        page.drawText(String(field.value), {
          x: field.rect.x * scaleX + 4,
          y: height - (field.rect.y + field.rect.height) * scaleY + 4,
          size: 12,
          font,
          color: rgb(0, 0, 0)
        })
      } catch { /* skip */ }
    }
  }

  return pdfDoc.save()
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
