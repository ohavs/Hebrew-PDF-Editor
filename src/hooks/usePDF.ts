import { useCallback, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { usePDFStore } from '../store'
import { useAnnotationsStore } from '../store'
import { useUIStore } from '../store'

// Set worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

export function usePDF() {
  const { setPdfDoc, setIsLoading, addRecentFile } = usePDFStore()
  const { loadFromStorage } = useAnnotationsStore()
  const { addToast } = useUIStore()

  const loadPDF = useCallback(async (source: File | string | ArrayBuffer) => {
    setIsLoading(true, 0)
    try {
      let data: ArrayBuffer
      let name = 'document.pdf'

      if (source instanceof File) {
        if (source.size > 50 * 1024 * 1024) {
          addToast('הקובץ גדול מ-50MB. הביצועים עלולים להיות איטיים.', 'warning')
        }
        data = await source.arrayBuffer()
        name = source.name
      } else if (typeof source === 'string') {
        const resp = await fetch(source)
        if (!resp.ok) throw new Error('Network error')
        data = await resp.arrayBuffer()
        const parts = source.split('/')
        name = decodeURIComponent(parts[parts.length - 1] || 'document.pdf')
        if (!name.endsWith('.pdf')) name += '.pdf'
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

      const pdfDoc = await loadingTask.promise
      setIsLoading(true, 95)

      const fileSize = source instanceof File ? source.size : data.byteLength
      setPdfDoc(pdfDoc, bytes, name, pdfDoc.numPages)
      loadFromStorage(name)
      addRecentFile(name, fileSize)
      setIsLoading(false)
      addToast(`נטען: ${name}`, 'success')
      return pdfDoc
    } catch (err: any) {
      setIsLoading(false)
      const msg = err?.message?.includes('Invalid PDF') ? 'הקובץ אינו PDF תקין' : 'שגיאה בטעינת הקובץ'
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
      const page = await pdfDoc.getPage(pageIndex + 1)
      // Render at 2× device pixel ratio for crisp path-based glyph rendering
      // (disableFontFace draws text as canvas paths; higher resolution prevents blur)
      const renderScale = zoom * window.devicePixelRatio * 2
      const viewport = page.getViewport({ scale: renderScale, rotation })

      canvas.width = viewport.width
      canvas.height = viewport.height
      canvas.style.width = `${viewport.width / (window.devicePixelRatio * 2)}px`
      canvas.style.height = `${viewport.height / (window.devicePixelRatio * 2)}px`

      const ctx = canvas.getContext('2d', { alpha: false })!
      ctx.imageSmoothingEnabled = false
      const renderContext = {
        canvasContext: ctx,
        viewport,
        background: 'white'
      }

      const task = page.render(renderContext)
      await task.promise
      page.cleanup()

      return {
        width: viewport.width / (window.devicePixelRatio * 2),
        height: viewport.height / (window.devicePixelRatio * 2)
      }
    } catch { return null }
  }, [])

  const renderThumbnail = useCallback(async (
    pdfDoc: any,
    pageIndex: number,
    canvas: HTMLCanvasElement,
    thumbWidth: number = 150
  ) => {
    try {
      const page = await pdfDoc.getPage(pageIndex + 1)
      const viewport = page.getViewport({ scale: 1 })
      const scale = thumbWidth / viewport.width
      const scaledViewport = page.getViewport({ scale })

      canvas.width = scaledViewport.width
      canvas.height = scaledViewport.height
      canvas.style.width = `${scaledViewport.width}px`
      canvas.style.height = `${scaledViewport.height}px`

      const ctx = canvas.getContext('2d')!
      await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise
      page.cleanup()
    } catch { /* ignore */ }
  }, [])

  return { loadPDF, renderPage, renderThumbnail }
}
