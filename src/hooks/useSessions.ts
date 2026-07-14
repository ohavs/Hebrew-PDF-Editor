import { useCallback, useEffect, useRef } from 'react'
import { usePDFStore, useAnnotationsStore, useUIStore } from '../store'
import { usePDF } from './usePDF'
import {
  saveSession, getSession, deleteSession as dbDeleteSession,
  sessionIdForName, type PdfSession,
} from '../utils/sessions'

// Build a small thumbnail dataURL from the first page of the loaded doc.
async function buildThumbnail(pdfDoc: any): Promise<string> {
  try {
    const page = await pdfDoc.getPage(1)
    const viewport = page.getViewport({ scale: 1 })
    const scale = 160 / viewport.width
    const v = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = v.width
    canvas.height = v.height
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport: v }).promise
    page.cleanup()
    return canvas.toDataURL('image/jpeg', 0.6)
  } catch {
    return ''
  }
}

/** Persist the current editing state into IndexedDB. */
export async function persistCurrentSession(thumbnail?: string): Promise<void> {
  const pdf = usePDFStore.getState()
  const ann = useAnnotationsStore.getState()
  if (!pdf.pdfBytes || !pdf.fileName) return

  const id = sessionIdForName(pdf.fileName)
  const existing = await getSession(id)
  const thumb = thumbnail ?? existing?.thumbnail ?? (pdf.pdfDoc ? await buildThumbnail(pdf.pdfDoc) : '')

  const session: PdfSession = {
    id,
    name: pdf.fileName,
    pdfBytes: pdf.pdfBytes.slice().buffer,
    annotations: ann.annotations,
    formFields: ann.formFields,
    pageOrder: pdf.pageOrder,
    pageInfos: pdf.pageInfos,
    watermark: pdf.watermark,
    pageNumbers: pdf.pageNumbers,
    pageCount: pdf.pageCount,
    currentPage: pdf.currentPage,
    zoom: pdf.zoom,
    thumbnail: thumb,
    fileSize: pdf.pdfBytes.byteLength,
    createdAt: existing?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  }
  await saveSession(session)
}

export function useSessions() {
  const { loadPDF } = usePDF()
  const { addToast } = useUIStore()

  const resumeSession = useCallback(async (id: string) => {
    const session = await getSession(id)
    if (!session) { addToast('הסשן לא נמצא', 'error'); return false }
    const pdfDoc = await loadPDF(session.pdfBytes.slice(0))
    if (!pdfDoc) return false
    // Restore the saved editing state on top of the freshly loaded document.
    usePDFStore.setState({
      fileName: session.name,
      pageOrder: session.pageOrder,
      pageInfos: session.pageInfos,
      watermark: (session as any).watermark ?? null,
      pageNumbers: (session as any).pageNumbers ?? null,
      currentPage: session.currentPage,
      zoom: session.zoom,
      hasUnsavedChanges: false,
    })
    useAnnotationsStore.setState({
      annotations: session.annotations,
      formFields: session.formFields,
      past: [], future: [], selectedId: null,
    })
    addToast(`ממשיך: ${session.name}`, 'success')
    return true
  }, [loadPDF, addToast])

  const removeSession = useCallback(async (id: string) => {
    await dbDeleteSession(id)
  }, [])

  return { resumeSession, removeSession, persistCurrentSession }
}

/** Periodically persist the full session so work is never lost. */
export function useSessionAutosave() {
  const { fileName, hasUnsavedChanges } = usePDFStore()
  const { autoSaveInterval } = useUIStore()
  const timerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!fileName) return
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      if (usePDFStore.getState().hasUnsavedChanges) {
        persistCurrentSession()
        usePDFStore.getState().setHasUnsavedChanges(false)
      }
    }, Math.max(5, autoSaveInterval) * 1000) as unknown as number
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [fileName, autoSaveInterval, hasUnsavedChanges])

  // Persist a first snapshot shortly after a document is opened.
  useEffect(() => {
    if (!fileName) return
    const t = setTimeout(() => persistCurrentSession(), 1500)
    return () => clearTimeout(t)
  }, [fileName])

  // Flush on app switch / tab close. Mobile browsers freeze or kill
  // backgrounded tabs immediately, so the interval alone loses up to
  // `autoSaveInterval` seconds of work on every app switch.
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden' && usePDFStore.getState().hasUnsavedChanges) {
        persistCurrentSession()
        usePDFStore.getState().setHasUnsavedChanges(false)
      }
    }
    const flushAlways = () => {
      if (usePDFStore.getState().hasUnsavedChanges) persistCurrentSession()
    }
    document.addEventListener('visibilitychange', flush)
    window.addEventListener('pagehide', flushAlways)
    return () => {
      document.removeEventListener('visibilitychange', flush)
      window.removeEventListener('pagehide', flushAlways)
    }
  }, [])
}
