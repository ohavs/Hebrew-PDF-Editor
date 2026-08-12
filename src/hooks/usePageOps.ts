import { PDFDocument, degrees } from 'pdf-lib'
import { usePDFStore, useAnnotationsStore, useUIStore } from '../store'
import { usePDF } from './usePDF'
import { embedAnnotationsIntoPdf, shareOrDownload, downloadBlob } from '../utils/pdfExport'
import { askFileName } from '../components/ui/PromptDialog'

/**
 * Bake annotations + display order + rotation into fresh bytes.
 * Live decorations (watermark / page numbers) are included only when
 * `withDecorations` is set — final outputs (save, split, compress, images)
 * want them; intermediate rebuilds (organize ops, merge-reload) must NOT
 * bake them, or they would duplicate on the next save.
 */
export function useEditedBytes() {
  const { pdfBytes, pageInfos, pageOrder } = usePDFStore()
  const { annotations, formFields } = useAnnotationsStore()
  return async (opts?: { withDecorations?: boolean }): Promise<Uint8Array> => {
    if (!pdfBytes) throw new Error('no pdf')
    const { watermark, pageNumbers } = usePDFStore.getState()
    const decorations = opts?.withDecorations ? { watermark, pageNumbers } : undefined
    const hasRotation = pageInfos.some(i => (i?.rotation || 0) % 360 !== 0)
    const isIdentity = pageOrder.every((n, i) => n === i)
    if (annotations.length === 0 && formFields.every(f => !f.value) && !hasRotation && isIdentity && !decorations?.watermark && !decorations?.pageNumbers) {
      return pdfBytes.slice()
    }
    return embedAnnotationsIntoPdf(pdfBytes, annotations, formFields, pageInfos, pageOrder, decorations)
  }
}

/**
 * Finish the document from anywhere — every tool panel gets this, so
 * completing a task never requires a detour through the editor. Bakes
 * annotations, page order, rotations and live decorations, then asks for a
 * file name.
 *
 * Download and share are separate on purpose: a button labelled "download"
 * that opened the system share sheet instead was the single most confusing
 * thing in the editor.
 */
export function useDownloadDocument() {
  const { fileName, pdfDoc } = usePDFStore()
  const { addToast } = useUIStore()
  const getEdited = useEditedBytes()

  const finish = async (mode: 'download' | 'share', opts?: { suffix?: string }): Promise<boolean> => {
    if (!pdfDoc) return false
    const base = fileName.replace(/\.pdf$/i, '')
    const suggested = `${base}${opts?.suffix ?? '-ערוך'}.pdf`
    const outName = await askFileName(suggested, '.pdf')
    if (!outName) return false
    try {
      const bytes = await getEdited({ withDecorations: true })
      if (mode === 'share') {
        const outcome = await shareOrDownload(bytes, outName)
        addToast(outcome === 'shared' ? 'הקובץ מוכן לשיתוף' : 'הקובץ ירד בהצלחה', 'success')
      } else {
        downloadBlob(bytes, outName)
        addToast('הקובץ ירד בהצלחה', 'success')
      }
      return true
    } catch (e) {
      console.error(e)
      addToast(mode === 'share' ? 'שגיאה בשיתוף' : 'שגיאה בהורדה', 'error')
      return false
    }
  }

  return {
    download: (opts?: { suffix?: string }) => finish('download', opts),
    share: (opts?: { suffix?: string }) => finish('share', opts),
    canDownload: !!pdfDoc,
  }
}

/**
 * Page-level document operations shared by the organize panel and the
 * mobile page list. All positions are DISPLAY positions (index into
 * pageOrder), since getEdited() bakes the display order into the bytes.
 */
export function usePageOps() {
  const { fileName, pageCount } = usePDFStore()
  const { addToast, confirm } = useUIStore()
  const { loadPDF } = usePDF()
  const getEdited = useEditedBytes()

  /** Current labels re-based to display order (the order getEdited bakes). */
  const bakedLabels = (): (string | null)[] => {
    const { pageOrder, pageLabels } = usePDFStore.getState()
    return pageOrder.map(n => pageLabels[n] ?? null)
  }

  const rebuild = async (
    fn: (src: PDFDocument, dest: PDFDocument) => Promise<void>,
    newLabels?: (string | null)[],
  ) => {
    const src = await PDFDocument.load(await getEdited())
    const dest = await PDFDocument.create()
    await fn(src, dest)
    await loadPDF((await dest.save()).buffer as ArrayBuffer, { name: fileName })
    if (newLabels) usePDFStore.getState().setPageLabels(newLabels)
  }

  const deletePage = async (pos: number): Promise<boolean> => {
    if (pageCount <= 1) { addToast('לא ניתן למחוק את הדף היחיד', 'error'); return false }
    const ok = await confirm({
      title: 'מחיקת דף',
      message: `דף ${pos + 1} יימחק מהמסמך. להמשיך?`,
      confirmLabel: 'מחק', danger: true,
    })
    if (!ok) return false
    try {
      const labels = bakedLabels()
      labels.splice(pos, 1)
      await rebuild(async (src, dest) => {
        const order = src.getPageIndices().filter(i => i !== pos)
        const pages = await dest.copyPages(src, order)
        pages.forEach(p => dest.addPage(p))
      }, labels)
      addToast('הדף נמחק', 'success')
      return true
    } catch (e) { console.error(e); addToast('שגיאה במחיקה', 'error'); return false }
  }

  const duplicatePage = async (pos: number): Promise<boolean> => {
    try {
      const labels = bakedLabels()
      labels.splice(pos + 1, 0, `עותק של עמוד ${pos + 1}`)
      await rebuild(async (src, dest) => {
        const order = src.getPageIndices()
        order.splice(pos + 1, 0, pos)
        const pages = await dest.copyPages(src, order)
        pages.forEach(p => dest.addPage(p))
      }, labels)
      addToast(`עמוד ${pos + 1} שוכפל — העותק נוסף אחריו`, 'success')
      return true
    } catch (e) { console.error(e); addToast('שגיאה בשכפול', 'error'); return false }
  }

  const addBlankAfter = async (pos: number, size?: [number, number]): Promise<boolean> => {
    try {
      const labels = bakedLabels()
      labels.splice(pos + 1, 0, 'דף ריק')
      const doc = await PDFDocument.load(await getEdited())
      doc.insertPage(pos + 1, size || [595, 842])
      await loadPDF((await doc.save()).buffer as ArrayBuffer, { name: fileName })
      usePDFStore.getState().setPageLabels(labels)
      addToast('דף ריק הוסף', 'success')
      return true
    } catch (e) { console.error(e); addToast('שגיאה בהוספה', 'error'); return false }
  }

  const rotateAllPages = async (): Promise<boolean> => {
    try {
      const labels = bakedLabels()
      const doc = await PDFDocument.load(await getEdited())
      doc.getPages().forEach(p => p.setRotation(degrees((p.getRotation().angle + 90) % 360)))
      await loadPDF((await doc.save()).buffer as ArrayBuffer, { name: fileName })
      usePDFStore.getState().setPageLabels(labels)
      addToast('כל הדפים סובבו', 'success')
      return true
    } catch (e) { console.error(e); addToast('שגיאה בסיבוב', 'error'); return false }
  }

  return { deletePage, duplicatePage, addBlankAfter, rotateAllPages, getEdited }
}
