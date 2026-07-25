import { useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { usePDFStore } from '../store'
import { useAnnotationsStore } from '../store'
import { useUIStore } from '../store'

// Set worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

// Track the in-flight pdf.js render per canvas so a newer render can cancel
// the older one instead of throwing "same canvas during multiple render()".
const renderTasks = new WeakMap<HTMLCanvasElement, any>()

const IS_COARSE = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
// iOS Safari fails silently above ~16.7M canvas pixels
const MAX_CANVAS_AREA = 16_000_000

export function usePDF() {
  const { setPdfDoc, setIsLoading, addRecentFile } = usePDFStore()
  const { loadFromStorage } = useAnnotationsStore()
  const { addToast } = useUIStore()

  const loadPDF = useCallback(async (
    source: File | string | ArrayBuffer,
    opts?: { name?: string; preserveAnnotations?: boolean }
  ) => {
    setIsLoading(true, 0)
    try {
      let data: ArrayBuffer
      let name = opts?.name || 'document.pdf'

      if (source instanceof File) {
        if (source.size > 50 * 1024 * 1024) {
          addToast('הקובץ גדול מ-50MB. הביצועים עלולים להיות איטיים.', 'warning')
        }
        data = await source.arrayBuffer()
        if (!opts?.name) name = source.name
      } else if (typeof source === 'string') {
        const resp = await fetch(source)
        if (!resp.ok) throw new Error('Network error')
        data = await resp.arrayBuffer()
        if (!opts?.name) {
          const parts = source.split('/')
          name = decodeURIComponent(parts[parts.length - 1] || 'document.pdf')
          if (!name.endsWith('.pdf')) name += '.pdf'
        }
      } else {
        data = source
      }

      const bytes = new Uint8Array(data)
      setIsLoading(true, 30)

      const base = import.meta.env.BASE_URL || '/'
      const loadingTask = pdfjsLib.getDocument({
        data: bytes.slice(),
        cMapUrl: `${base}cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${base}standard_fonts/`,
        // Path-based glyph rendering: draws embedded font outlines directly by
        // glyph index (like Adobe), instead of routing through browser @font-face.
        // This is the reliable fix for Hebrew PDFs with custom font encodings
        // that render garbled when the browser tries to match glyphs.
        disableFontFace: true,
        useSystemFonts: false,
      })
      loadingTask.onProgress = (p: { loaded: number; total: number }) => {
        if (p.total > 0) setIsLoading(true, 30 + Math.round((p.loaded / p.total) * 60))
      }
      // Password-protected PDFs (bank statements, payslips...) — prompt
      // instead of failing with a generic load error. reason 2 = wrong password.
      loadingTask.onPassword = (updatePassword: (pw: string) => void, reason: number) => {
        const pw = window.prompt(reason === 2 ? 'סיסמה שגויה. נסה שוב:' : 'הקובץ מוגן בסיסמה. הזן סיסמה:')
        if (pw !== null && pw !== '') updatePassword(pw)
        else throw new Error('PasswordCancelled')
      }

      const pdfDoc = await loadingTask.promise
      setIsLoading(true, 95)

      const fileSize = source instanceof File ? source.size : data.byteLength
      setPdfDoc(pdfDoc, bytes, name, pdfDoc.numPages)
      if (!opts?.preserveAnnotations) loadFromStorage(name)
      addRecentFile(name, fileSize)
      setIsLoading(false)
      addToast(`נטען: ${name}`, 'success')
      return pdfDoc
    } catch (err: any) {
      console.error('loadPDF failed', err)
      setIsLoading(false)
      const msg = err?.message?.includes('PasswordCancelled') || err?.name === 'PasswordException'
        ? 'הקובץ מוגן בסיסמה'
        : err?.message?.includes('Invalid PDF') ? 'הקובץ אינו PDF תקין' : 'שגיאה בטעינת הקובץ'
      addToast(msg, 'error')
      return null
    }
  }, [])

  const renderPage = useCallback(async (
    pdfDoc: any,
    pageIndex: number,
    canvas: HTMLCanvasElement,
    zoom: number,
    rotation: number = 0
  ) => {
    try {
      // Cancel any in-flight render on this canvas first
      const prev = renderTasks.get(canvas)
      if (prev) {
        prev.cancel()
        try { await prev.promise } catch { /* RenderingCancelledException */ }
      }

      const page = await pdfDoc.getPage(pageIndex + 1)
      // Compose with the page's intrinsic /Rotate instead of overriding it
      const totalRotation = (((page.rotate || 0) + rotation) % 360 + 360) % 360
      const dpr = window.devicePixelRatio || 1

      // Supersampling factor for crisp path-based glyphs, capped so phone
      // canvases stay within safe memory limits (iOS silently fails above
      // ~16.7M pixels and blanks the page).
      let outputScale = Math.min(dpr * 2, IS_COARSE ? 2.5 : 4)
      const naturalViewport = page.getViewport({ scale: 1, rotation: totalRotation })
      const naturalW = naturalViewport.width
      const naturalH = naturalViewport.height
      const areaAtScale = (s: number) => naturalW * zoom * s * naturalH * zoom * s
      while (outputScale > 1 && areaAtScale(outputScale) > MAX_CANVAS_AREA) {
        outputScale = Math.max(1, outputScale - 0.5)
      }

      const viewport = page.getViewport({ scale: zoom * outputScale, rotation: totalRotation })

      // Round to integer CSS pixels to prevent subpixel blurring
      const cssW = Math.round(viewport.width / outputScale)
      const cssH = Math.round(viewport.height / outputScale)

      // Backing store only — display size is owned by the component's CSS
      canvas.width = Math.round(cssW * outputScale)
      canvas.height = Math.round(cssH * outputScale)

      const ctx = canvas.getContext('2d', { alpha: false })!
      ctx.imageSmoothingEnabled = false

      const task = page.render({
        canvasContext: ctx,
        viewport,
        background: 'white',
      })
      renderTasks.set(canvas, task)
      await task.promise
      renderTasks.delete(canvas)
      page.cleanup()

      return {
        width: cssW,
        height: cssH,
        naturalWidth: naturalW,
        naturalHeight: naturalH,
      }
    } catch (e: any) {
      if (e?.name !== 'RenderingCancelledException') console.error('renderPage failed', e)
      return null
    }
  }, [])

  const renderThumbnail = useCallback(async (
    pdfDoc: any,
    pageIndex: number,
    canvas: HTMLCanvasElement,
    thumbWidth: number = 150,
    rotation: number = 0
  ) => {
    try {
      const page = await pdfDoc.getPage(pageIndex + 1)
      const totalRotation = (((page.rotate || 0) + rotation) % 360 + 360) % 360
      const viewport = page.getViewport({ scale: 1, rotation: totalRotation })
      const scale = thumbWidth / viewport.width
      const scaledViewport = page.getViewport({ scale, rotation: totalRotation })

      // Bitmap size only — CSS sizing belongs to the caller's layout.
      // (Forcing pixel width/height here clipped thumbnails inside sized boxes.)
      canvas.width = scaledViewport.width
      canvas.height = scaledViewport.height

      const ctx = canvas.getContext('2d')!
      await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise
      page.cleanup()
    } catch { /* ignore */ }
  }, [])

  return { loadPDF, renderPage, renderThumbnail }
}
