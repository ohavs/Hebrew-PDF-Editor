import { useCallback } from 'react'
import { usePDFStore, useAnnotationsStore, useUIStore } from '../store'
import type { ImageAnnotation, TextBoxAnnotation, Point } from '../store/types'

/** How much of the page a freshly inserted picture takes at most. */
const MAX_FRACTION = 0.6
const MAX_SOURCE_PIXELS = 4_000_000 // ~4MP; larger sources are downscaled

/**
 * Where a screen point lands in the document: which page, and where on it in
 * natural (zoom-1) coordinates. Used for dropping and pasting at the pointer
 * rather than always in the middle.
 */
export function pointToPage(clientX: number, clientY: number): { pageIndex: number; point: Point } | null {
  const el = document.elementFromPoint(clientX, clientY)
  const wrapper = el?.closest('[id^="page-"]') as HTMLElement | null
  if (!wrapper) return null
  const pageIndex = parseInt(wrapper.id.replace('page-', ''))
  if (Number.isNaN(pageIndex)) return null
  const box = wrapper.getBoundingClientRect()
  const zoom = usePDFStore.getState().zoom
  return {
    pageIndex,
    point: { x: (clientX - box.left) / zoom, y: (clientY - box.top) / zoom },
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsDataURL(file)
  })
}

function measure(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('decode failed'))
    img.src = src
  })
}

/**
 * Very large photos are re-encoded before they become part of the document —
 * a 12MP phone picture as a base64 data URL is tens of megabytes, which would
 * be carried in every autosave and every undo snapshot.
 */
async function downscale(src: string, width: number, height: number): Promise<string> {
  if (width * height <= MAX_SOURCE_PIXELS) return src
  const scale = Math.sqrt(MAX_SOURCE_PIXELS / (width * height))
  const img = new Image()
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  // JPEG unless the source has transparency to protect
  return src.startsWith('data:image/png')
    ? canvas.toDataURL('image/png')
    : canvas.toDataURL('image/jpeg', 0.9)
}

export function useInsertImage() {
  const { addToast } = useUIStore()

  /** Place a picture, fitted to the page and centred on `at` if given. */
  const insertImage = useCallback(async (
    src: string,
    opts?: { pageIndex?: number; at?: Point },
  ): Promise<string | null> => {
    const { pageInfos, currentPage, pageCount } = usePDFStore.getState()
    if (!pageCount) { addToast('פתח או צור מסמך קודם', 'warning'); return null }

    const pageIndex = Math.min(Math.max(opts?.pageIndex ?? currentPage, 0), pageCount - 1)
    const info = pageInfos[pageIndex]
    const pageW = info?.width || 595
    const pageH = info?.height || 842

    let natural: { width: number; height: number }
    try { natural = await measure(src) } catch { addToast('לא ניתן לקרוא את התמונה', 'error'); return null }
    const data = await downscale(src, natural.width, natural.height)

    const ratio = natural.height / natural.width
    let width = Math.min(natural.width, pageW * MAX_FRACTION)
    let height = width * ratio
    if (height > pageH * MAX_FRACTION) {
      height = pageH * MAX_FRACTION
      width = height / ratio
    }

    const centre = opts?.at ?? { x: pageW / 2, y: pageH / 2 }
    // Keep the whole picture on the page even when dropped near an edge
    const x = Math.max(0, Math.min(pageW - width, centre.x - width / 2))
    const y = Math.max(0, Math.min(pageH - height, centre.y - height / 2))

    const { addAnnotation, selectAnnotation, pushHistory } = useAnnotationsStore.getState()
    pushHistory()
    const ann: Omit<ImageAnnotation, 'id' | 'createdAt'> = {
      type: 'image',
      pageIndex,
      rect: { x, y, width, height },
      imageData: data,
      rotation: 0,
      opacity: 1,
      cornerRadius: 0,
      naturalRatio: ratio,
    }
    const id = addAnnotation(ann)
    selectAnnotation(id)
    return id
  }, [addToast])

  const insertImageFiles = useCallback(async (files: File[], opts?: { pageIndex?: number; at?: Point }) => {
    const images = files.filter(f => f.type.startsWith('image/'))
    if (!images.length) return 0
    let placed = 0
    for (const [i, file] of images.entries()) {
      try {
        const src = await readAsDataUrl(file)
        // Stagger multiples so they don't land exactly on top of each other
        const at = opts?.at ? { x: opts.at.x + i * 16, y: opts.at.y + i * 16 } : undefined
        if (await insertImage(src, { ...opts, at })) placed++
      } catch (e) { console.error('image insert failed', e) }
    }
    if (placed) addToast(placed === 1 ? 'התמונה נוספה' : `${placed} תמונות נוספו`, 'success')
    return placed
  }, [insertImage, addToast])

  /** Pasted or dropped text becomes an editable text box. */
  const insertText = useCallback((text: string, opts?: { pageIndex?: number; at?: Point }) => {
    const { pageInfos, currentPage, pageCount } = usePDFStore.getState()
    if (!pageCount || !text.trim()) return null
    const pageIndex = Math.min(Math.max(opts?.pageIndex ?? currentPage, 0), pageCount - 1)
    const info = pageInfos[pageIndex]
    const pageW = info?.width || 595
    const pageH = info?.height || 842

    const ui = useUIStore.getState()
    const rtl = /[֐-׿]/.test(text)
    const width = Math.min(pageW * 0.7, 420)
    // Rough but reasonable: the box grows on edit anyway
    const lines = text.split('\n').length + Math.floor(text.length / 60)
    const height = Math.max(44, Math.min(pageH * 0.8, (lines + 1) * ui.textSize * 1.5))
    const centre = opts?.at ?? { x: pageW / 2, y: pageH / 3 }

    const { addAnnotation, selectAnnotation, pushHistory } = useAnnotationsStore.getState()
    pushHistory()
    const box: Omit<TextBoxAnnotation, 'id' | 'createdAt'> = {
      type: 'textbox',
      pageIndex,
      rect: {
        x: Math.max(0, Math.min(pageW - width, centre.x - width / 2)),
        y: Math.max(0, Math.min(pageH - height, centre.y - height / 2)),
        width, height,
      },
      content: text,
      fontFamily: ui.textFont,
      fontSize: ui.textSize,
      fontWeight: ui.textBold ? 'bold' : 'normal',
      fontStyle: ui.textItalic ? 'italic' : 'normal',
      textDecoration: ui.textUnderline ? 'underline' : 'none',
      color: ui.textColor,
      align: rtl ? 'right' : 'left',
      direction: rtl ? 'rtl' : 'ltr',
    }
    const id = addAnnotation(box)
    selectAnnotation(id)
    return id
  }, [])

  return { insertImage, insertImageFiles, insertText }
}
