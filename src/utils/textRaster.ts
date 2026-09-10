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

/** Defaults for the optional layout fields, in one place. */
export function textBoxStyle(ann: TextBoxAnnotation) {
  return {
    lineHeightFactor: ann.lineHeight ?? 1.4,
    letterSpacing: ann.letterSpacing ?? 0,
    background: ann.backgroundColor && ann.backgroundColor !== 'transparent' ? ann.backgroundColor : null,
    padding: ann.padding ?? 7,
    borderColor: ann.borderColor ?? '#000000',
    borderWidth: ann.borderWidth ?? 0,
    borderRadius: ann.borderRadius ?? 0,
    rotation: ann.rotation ?? 0,
    opacity: ann.opacity ?? 1,
  }
}

/**
 * Render a text box to an image matching its on-screen look.
 *
 * A rotated box is drawn into the axis-aligned box of its rotated form, the
 * same trick stamps use, so the exporter only ever places an upright
 * rectangle — `rotated` tells it to centre rather than corner-anchor.
 */
export function rasterizeTextBox(ann: TextBoxAnnotation): (RasterResult & { rotated: boolean }) | null {
  const text = ann.content?.trim()
  const style = textBoxStyle(ann)
  if (!text && !style.background && !style.borderWidth) return null

  const pad = style.padding
  const padY = Math.max(2, pad * 0.6) // the vertical inset has always been tighter
  const lineHeight = ann.fontSize * style.lineHeightFactor
  const measure = document.createElement('canvas').getContext('2d')!
  const fontStr = `${ann.fontStyle === 'italic' ? 'italic ' : ''}${ann.fontWeight === 'bold' ? '700' : '400'} ${ann.fontSize * SCALE}px '${ann.fontFamily}', 'Heebo', sans-serif`

  measure.font = fontStr
  if (style.letterSpacing) measure.letterSpacing = `${style.letterSpacing * SCALE}px`
  const maxTextWidth = (ann.rect.width - pad * 2) * SCALE
  const lines = text ? wrapLines(measure, ann.content, maxTextWidth) : []
  const boxW = ann.rect.width
  const boxH = Math.max(ann.rect.height, lines.length * lineHeight + padY * 2)

  const rad = (style.rotation * Math.PI) / 180
  const aabbW = style.rotation ? Math.abs(boxW * Math.cos(rad)) + Math.abs(boxH * Math.sin(rad)) : boxW
  const aabbH = style.rotation ? Math.abs(boxW * Math.sin(rad)) + Math.abs(boxH * Math.cos(rad)) : boxH

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(aabbW * SCALE)
  canvas.height = Math.ceil(aabbH * SCALE)
  const ctx = canvas.getContext('2d')!
  ctx.scale(SCALE, SCALE)
  ctx.globalAlpha = style.opacity
  // Work in the box's own frame: origin at its top-left, rotated about centre
  ctx.translate(aabbW / 2, aabbH / 2)
  if (style.rotation) ctx.rotate(rad)
  ctx.translate(-boxW / 2, -boxH / 2)

  if (style.background || style.borderWidth) {
    ctx.beginPath()
    if (style.borderRadius > 0) {
      ctx.roundRect(0, 0, boxW, boxH, Math.min(style.borderRadius, boxW / 2, boxH / 2))
    } else {
      ctx.rect(0, 0, boxW, boxH)
    }
    if (style.background) { ctx.fillStyle = style.background; ctx.fill() }
    if (style.borderWidth > 0) {
      ctx.strokeStyle = style.borderColor
      ctx.lineWidth = style.borderWidth
      ctx.stroke()
    }
  }

  if (!lines.length) {
    return { dataUrl: canvas.toDataURL('image/png'), width: aabbW, height: aabbH, rotated: !!style.rotation }
  }

  const isRTL = ann.direction === 'rtl' ||
    (ann.direction === 'auto' && /[֐-׿؀-ۿ]/.test(text!))

  ctx.font = fontStr.replace(`${ann.fontSize * SCALE}px`, `${ann.fontSize}px`)
  if (style.letterSpacing) ctx.letterSpacing = `${style.letterSpacing}px`
  ctx.fillStyle = ann.color
  ctx.textBaseline = 'alphabetic'
  ctx.direction = isRTL ? 'rtl' : 'ltr'

  const align = ann.align === 'justify' ? (isRTL ? 'right' : 'left') : ann.align
  let anchorX: number
  if (align === 'center') { ctx.textAlign = 'center'; anchorX = boxW / 2 }
  else if (align === 'left') { ctx.textAlign = 'left'; anchorX = pad }
  else { ctx.textAlign = 'right'; anchorX = boxW - pad }

  lines.forEach((line, i) => {
    const baselineY = padY + (i + 1) * lineHeight - lineHeight * 0.28
    ctx.fillText(line, anchorX, baselineY)
    if (ann.textDecoration === 'underline' && line) {
      const w = ctx.measureText(line).width
      const x0 = ctx.textAlign === 'center' ? anchorX - w / 2
        : ctx.textAlign === 'right' ? anchorX - w : anchorX
      ctx.fillRect(x0, baselineY + 2, w, Math.max(0.5, ann.fontSize * 0.06))
    }
  })

  return { dataUrl: canvas.toDataURL('image/png'), width: aabbW, height: aabbH, rotated: !!style.rotation }
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

/**
 * A running header or footer, drawn as artwork.
 *
 * Hebrew cannot go through a built-in PDF font, so the text is painted on a
 * canvas and embedded as a picture — the same route every other Hebrew string
 * in this app takes on the way out.
 */
export function rasterizeStampText(
  text: string,
  fontSize: number,
  color: string,
  bold: boolean,
  fontFamily: string,
): RasterResult {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const font = `${bold ? 700 : 400} ${fontSize * SCALE}px '${fontFamily}', 'Heebo', sans-serif`
  ctx.font = font
  const w = ctx.measureText(text).width / SCALE + 2
  const h = fontSize * 1.4
  canvas.width = Math.max(1, Math.ceil(w * SCALE))
  canvas.height = Math.max(1, Math.ceil(h * SCALE))
  // Sizing the canvas resets the context, so the font is set again
  ctx.font = font
  ctx.fillStyle = color
  ctx.direction = /[֐-׿]/.test(text) ? 'rtl' : 'ltr'
  ctx.textAlign = ctx.direction === 'rtl' ? 'right' : 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, ctx.textAlign === 'right' ? canvas.width : 0, canvas.height / 2)
  return { dataUrl: canvas.toDataURL('image/png'), width: w, height: h }
}
