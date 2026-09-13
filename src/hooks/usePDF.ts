import { useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { usePDFStore } from '../store'
import { useAnnotationsStore } from '../store'
import { useUIStore } from '../store'
import { detectFormFields } from '../utils/formFields'
import { askPassword } from '../components/ui/PromptDialog'

// Set worker.
//
// pdf.js v5 calls Map.prototype.getOrInsertComputed, which Safari and
// slightly-older Chrome don't have. main.tsx patches the page's realm, but
// the worker is a separate one — parsing a document with an AcroForm or
// standard fonts hits the missing method there and every page render fails
// to an endless skeleton. So the worker script is loaded through a tiny
// module that installs the polyfill first (the same blob-wrapper trick
// pdf.js itself uses for cross-origin workers).
const workerUrl = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString()
const workerBootstrap = `
for (const p of [Map.prototype, WeakMap.prototype]) {
  if (!p.getOrInsertComputed) {
    p.getOrInsertComputed = function (k, cb) { if (!this.has(k)) this.set(k, cb(k)); return this.get(k) }
  }
  if (!p.getOrInsert) {
    p.getOrInsert = function (k, v) { if (!this.has(k)) this.set(k, v); return this.get(k) }
  }
}
await import(${JSON.stringify(workerUrl)});
`
pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(
  new Blob([workerBootstrap], { type: 'text/javascript' })
)

// Track the in-flight pdf.js render per canvas so a newer render can cancel
// the older one instead of throwing "same canvas during multiple render()".
const renderTasks = new WeakMap<HTMLCanvasElement, any>()
// ...and a per-canvas promise chain, because cancelling isn't enough on its
// own: two calls could both get past the cancel check while awaiting getPage,
// and pdf.js then refuses to draw twice on one canvas. That error left the
// page stuck under its skeleton forever — resuming a session on a phone hit
// it every time, since the fit-to-width zoom lands right on top of the first
// render.
const renderChains = new WeakMap<HTMLCanvasElement, Promise<unknown>>()

/** Run `job` only once whatever else is drawing on this canvas is done. */
function queueOnCanvas<T>(canvas: HTMLCanvasElement, job: () => Promise<T>): Promise<T> {
  const chain = (renderChains.get(canvas) ?? Promise.resolve()).then(job, job)
  renderChains.set(canvas, chain.catch(() => {}))
  return chain
}

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
    // Declared outside the try so the catch can tell a cancelled password
    // dialog from a document that genuinely would not open
    let passwordCancelled = false
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
      // Password-protected PDFs (bank statements, payslips...) — ask instead
      // of failing with a generic load error. reason 2 = the last one was wrong.
      //
      // pdf.js calls this without waiting, so the answer is handed back when
      // the dialog closes rather than returned from here. Cancelling has to
      // reject the load explicitly, or the task would wait for a password that
      // is never coming.
      loadingTask.onPassword = (updatePassword: (pw: string) => void, reason: number) => {
        askPassword(reason === 2).then(pw => {
          if (pw) { updatePassword(pw); return }
          // Nothing here can reject the load, so the task is destroyed and the
          // pending promise rejects on its own; the flag says the rejection
          // was asked for and needs no error shouted about it
          passwordCancelled = true
          loadingTask.destroy()
        })
      }

      const pdfDoc = await loadingTask.promise
      setIsLoading(true, 95)

      const fileSize = source instanceof File ? source.size : data.byteLength
      setPdfDoc(pdfDoc, bytes, name, pdfDoc.numPages)
      if (!opts?.preserveAnnotations) loadFromStorage(name)
      addRecentFile(name, fileSize)
      setIsLoading(false)
      addToast(`נטען: ${name}`, 'success')

      // Scan for AcroForm widgets in the background — it walks every page,
      // and the document is already usable without it. Anything restored
      // from storage wins, so a half-filled form isn't wiped on reopen.
      if (!opts?.preserveAnnotations && !useAnnotationsStore.getState().formFields.length) {
        detectFormFields(pdfDoc).then(fields => {
          if (!fields.length) return
          if (usePDFStore.getState().pdfDoc !== pdfDoc) return // a newer document won
          if (useAnnotationsStore.getState().formFields.length) return
          useAnnotationsStore.getState().importFormFields(fields)
          addToast(`זוהה טופס עם ${fields.length} שדות — אפשר למלא אותו ישירות`, 'success')
        }).catch(e => console.warn('form detection failed', e))
      }
      return pdfDoc
    } catch (err: any) {
      setIsLoading(false)
      // Backing out of the password dialog is a decision, not a failure
      if (passwordCancelled) return null
      console.error('loadPDF failed', err)
      const msg = err?.name === 'PasswordException'
        ? 'הקובץ מוגן בסיסמה'
        : err?.message?.includes('Invalid PDF') ? 'הקובץ אינו PDF תקין' : 'שגיאה בטעינת הקובץ'
      addToast(msg, 'error')
      return null
    }
  }, [])

  const renderPage = useCallback((
    pdfDoc: any,
    pageIndex: number,
    canvas: HTMLCanvasElement,
    zoom: number,
    rotation: number = 0
  ) => {
    // Cut the current render short right away — synchronously, before any
    // await, so a burst of zoom changes doesn't queue full renders
    try { renderTasks.get(canvas)?.cancel() } catch { /* already settled */ }

    const run = async () => {
      try {
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
    }

    // Queue behind whatever is already drawing on this canvas, whether it
    // finished, failed or was cancelled
    return queueOnCanvas(canvas, run)
  }, [])

  const renderThumbnail = useCallback(async (
    pdfDoc: any,
    pageIndex: number,
    canvas: HTMLCanvasElement,
    thumbWidth: number = 150,
    rotation: number = 0
  ) => {
    // Same serialization as the page canvases: rotating or reordering pages
    // re-renders a thumbnail that may still be drawing, and a second render
    // on one canvas leaves it permanently blank.
    return queueOnCanvas(canvas, async () => {
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
      } catch (e: any) {
        if (e?.name !== 'RenderingCancelledException') console.warn('thumbnail render failed', e)
      }
    })
  }, [])

  return { loadPDF, renderPage, renderThumbnail }
}
