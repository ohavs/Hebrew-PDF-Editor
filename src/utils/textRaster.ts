// Canvas-based text rasterization for PDF export.
// pdf-lib's standard fonts are WinAnsi-encoded and cannot encode Hebrew
// (U+0590–U+05FF). Rasterizing text to a PNG and embedding it as an image
// gives pixel-perfect Hebrew/RTL output with zero font-embedding work —
// the same approach the watermark tool already uses.
import type { TextBoxAnnotation, StampAnnotation, StickyAnnotation } from '../store/types'

const SCALE = 3 // supersample for crisp print/zoom

export interface RasterResult {
  dataUrl: string
  /** Size in natural display px (== PDF points) */
  width: number
  height: number
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = []
  for (const hardLine of text.split('\n')) {
    if (!hardLine) { out.push(''); continue }
    const words = hardLine.split(' ')
    let line = ''
    for (const word of words) {
      const probe = line ? `${line} ${word}` : word
      if (ctx.measureText(probe).width > maxWidth && line) {
        out.push(line)
        line = word
      } else {
        line = probe
      }
    }
    out.push(line)
  }
  return out
}

/** Render a text box annotation to an image matching its on-screen look. */
export function rasterizeTextBox(ann: TextBoxAnnotation): RasterResult | null {
  const text = ann.content?.trim()
  if (!text) return null

  const padX = 7, padY = 4 // match TextBox inner padding
  const lineHeight = ann.fontSize * 1.4
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const fontStr = `${ann.fontStyle === 'italic' ? 'italic ' : ''}${ann.fontWeight === 'bold' ? '700' : '400'} ${ann.fontSize * SCALE}px '${ann.fontFamily}', 'Heebo', sans-serif`

  ctx.font = fontStr
  const maxTextWidth = (ann.rect.width - padX * 2) * SCALE
  const lines = wrapLines(ctx, ann.content, maxTextWidth)
  const height = Math.max(ann.rect.height, lines.length * lineHeight + padY * 2)

  canvas.width = Math.ceil(ann.rect.width * SCALE)
  canvas.height = Math.ceil(height * SCALE)

  const isRTL = ann.direction === 'rtl' ||
    (ann.direction === 'auto' && /[֐-׿؀-ۿ]/.test(text))

  ctx.font = fontStr
  ctx.fillStyle = ann.color
  ctx.textBaseline = 'alphabetic'
  ctx.direction = isRTL ? 'rtl' : 'ltr'

  const align = ann.align === 'justify' ? (isRTL ? 'right' : 'left') : ann.align
  let anchorX: number
  if (align === 'center') { ctx.textAlign = 'center'; anchorX = canvas.width / 2 }
  else if (align === 'left') { ctx.textAlign = 'left'; anchorX = padX * SCALE }
  else { ctx.textAlign = 'right'; anchorX = canvas.width - padX * SCALE }

  lines.forEach((line, i) => {
    const baselineY = (padY + (i + 1) * lineHeight - lineHeight * 0.28) * SCALE
    ctx.fillText(line, anchorX, baselineY)
    if (ann.textDecoration === 'underline' && line) {
      const w = ctx.measureText(line).width
      const x0 = ctx.textAlign === 'center' ? anchorX - w / 2
        : ctx.textAlign === 'right' ? anchorX - w : anchorX
      ctx.fillRect(x0, baselineY + 2 * SCALE, w, Math.max(1, ann.fontSize * SCALE * 0.06))
    }
  })

  return { dataUrl: canvas.toDataURL('image/png'), width: ann.rect.width, height }
}

/**
 * Render a stamp (border + rotated text) into the axis-aligned bounding box
 * of its rotated form, so the export can place it as a plain image.
 */
export function rasterizeStamp(ann: StampAnnotation): RasterResult {
  const { width: w, height: h } = ann.rect
  const rad = (ann.rotation * Math.PI) / 180
  const aabbW = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad))
  const aabbH = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad))

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(aabbW * SCALE)
  canvas.height = Math.ceil(aabbH * SCALE)
  const ctx = canvas.getContext('2d')!

  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate(rad)
  ctx.globalAlpha = 0.8

  // Border
  ctx.strokeStyle = ann.color
  ctx.lineWidth = 2 * SCALE
  const r = 4 * SCALE
  const bw = w * SCALE, bh = h * SCALE
  ctx.beginPath()
  ctx.roundRect(-bw / 2, -bh / 2, bw, bh, r)
  ctx.stroke()

  // Text
  ctx.font = `700 ${ann.fontSize * SCALE}px ${ann.isHebrew ? "'Heebo'" : "'Arial'"}, sans-serif`
  ctx.fillStyle = ann.color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(ann.text, 0, 0)

  return { dataUrl: canvas.toDataURL('image/png'), width: aabbW, height: aabbH }
}

/** Render a sticky note as a small yellow card with its content. */
export function rasterizeStickyCard(ann: StickyAnnotation): RasterResult | null {
  const content = ann.content?.trim()
  const cardW = 160
  const pad = 8
  const fontSize = 10
  const lineHeight = fontSize * 1.45

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  ctx.font = `400 ${fontSize * SCALE}px 'Heebo', sans-serif`
  const lines = content ? wrapLines(ctx, content, (cardW - pad * 2) * SCALE) : []
  const cardH = Math.max(24, lines.length * lineHeight + pad * 2)

  canvas.width = Math.ceil(cardW * SCALE)
  canvas.height = Math.ceil(cardH * SCALE)

  // Card
  ctx.fillStyle = '#fef9c3'
  ctx.strokeStyle = '#eab308'
  ctx.lineWidth = SCALE
  ctx.beginPath()
  ctx.roundRect(SCALE, SCALE, canvas.width - 2 * SCALE, canvas.height - 2 * SCALE, 4 * SCALE)
  ctx.fill()
  ctx.stroke()

  // Content (RTL)
  ctx.font = `400 ${fontSize * SCALE}px 'Heebo', sans-serif`
  ctx.fillStyle = '#713f12'
  ctx.direction = 'rtl'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'alphabetic'
  lines.forEach((line, i) => {
    ctx.fillText(line, canvas.width - pad * SCALE, (pad + (i + 1) * lineHeight - lineHeight * 0.3) * SCALE)
  })

  return { dataUrl: canvas.toDataURL('image/png'), width: cardW, height: cardH }
}

/** Render a plain text string (e.g. a form value) to an image. */
export function rasterizePlainText(text: string, fontSize: number, color: string, maxWidth: number): RasterResult | null {
  if (!text.trim()) return null
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  ctx.font = `400 ${fontSize * SCALE}px 'Heebo', sans-serif`
  const w = Math.min(maxWidth, ctx.measureText(text).width / SCALE + 2)
  const h = fontSize * 1.4
  canvas.width = Math.ceil(w * SCALE)
  canvas.height = Math.ceil(h * SCALE)
  ctx.font = `400 ${fontSize * SCALE}px 'Heebo', sans-serif`
  ctx.fillStyle = color
  ctx.direction = /[֐-׿]/.test(text) ? 'rtl' : 'ltr'
  ctx.textAlign = ctx.direction === 'rtl' ? 'right' : 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, ctx.textAlign === 'right' ? canvas.width : 0, canvas.height / 2)
  return { dataUrl: canvas.toDataURL('image/png'), width: w, height: h }
}
