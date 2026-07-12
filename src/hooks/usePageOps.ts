import { PDFDocument, degrees } from 'pdf-lib'
import { usePDFStore, useAnnotationsStore, useUIStore } from '../store'
import { usePDF } from './usePDF'
import { embedAnnotationsIntoPdf } from '../utils/pdfExport'

/** Bake annotations + display order + rotation into fresh bytes. */
export function useEditedBytes() {
  const { pdfBytes, pageInfos, pageOrder } = usePDFStore()
  const { annotations, formFields } = useAnnotationsStore()
  return async (): Promise<Uint8Array> => {
    if (!pdfBytes) throw new Error('no pdf')
    const hasRotation = pageInfos.some(i => (i?.rotation || 0) % 360 !== 0)
    const isIdentity = pageOrder.every((n, i) => n === i)
    if (annotations.length === 0 && formFields.every(f => !f.value) && !hasRotation && isIdentity) {
      return pdfBytes.slice()
    }
    return embedAnnotationsIntoPdf(pdfBytes, annotations, formFields, pageInfos, pageOrder)
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

  const rebuild = async (fn: (src: PDFDocument, dest: PDFDocument) => Promise<void>) => {
    const src = await PDFDocument.load(await getEdited())
    const dest = await PDFDocument.create()
    await fn(src, dest)
    await loadPDF((await dest.save()).buffer as ArrayBuffer, { name: fileName })
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
      await rebuild(async (src, dest) => {
        const order = src.getPageIndices().filter(i => i !== pos)
        const pages = await dest.copyPages(src, order)
        pages.forEach(p => dest.addPage(p))
      })
      addToast('הדף נמחק', 'success')
      return true
    } catch (e) { console.error(e); addToast('שגיאה במחיקה', 'error'); return false }
  }

  const duplicatePage = async (pos: number): Promise<boolean> => {
    try {
      await rebuild(async (src, dest) => {
        const order = src.getPageIndices()
        order.splice(pos + 1, 0, pos)
        const pages = await dest.copyPages(src, order)
        pages.forEach(p => dest.addPage(p))
      })
      addToast('הדף שוכפל', 'success')
      return true
    } catch (e) { console.error(e); addToast('שגיאה בשכפול', 'error'); return false }
  }

  const addBlankAfter = async (pos: number, size?: [number, number]): Promise<boolean> => {
    try {
      const doc = await PDFDocument.load(await getEdited())
      doc.insertPage(pos + 1, size || [595, 842])
      await loadPDF((await doc.save()).buffer as ArrayBuffer, { name: fileName })
      addToast('דף ריק הוסף', 'success')
      return true
    } catch (e) { console.error(e); addToast('שגיאה בהוספה', 'error'); return false }
  }

  const rotateAllPages = async (): Promise<boolean> => {
    try {
      const doc = await PDFDocument.load(await getEdited())
      doc.getPages().forEach(p => p.setRotation(degrees((p.getRotation().angle + 90) % 360)))
      await loadPDF((await doc.save()).buffer as ArrayBuffer, { name: fileName })
      addToast('כל הדפים סובבו', 'success')
      return true
    } catch (e) { console.error(e); addToast('שגיאה בסיבוב', 'error'); return false }
  }

  return { deletePage, duplicatePage, addBlankAfter, rotateAllPages, getEdited }
}
