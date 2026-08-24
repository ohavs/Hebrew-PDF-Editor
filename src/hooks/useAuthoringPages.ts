import { useCallback } from 'react'
import { PDFDocument } from 'pdf-lib'
import { usePDFStore, useAnnotationsStore, useUIStore } from '../store'
import { usePDF } from './usePDF'

/**
 * Adding pages while designing.
 *
 * The organize tool's version bakes the object layer into the file first,
 * which is right when you are shuffling a finished document and wrong here —
 * mid-design it would flatten everything you are still editing. This one
 * touches the raw bytes and shifts the objects that sit after the new page.
 */
export function useAuthoringPages() {
  const { loadPDF } = usePDF()
  const { addToast } = useUIStore()

  const addBlankPage = useCallback(async (after: number | 'end'): Promise<boolean> => {
    const { pdfBytes, pageOrder, pageCount, fileName } = usePDFStore.getState()
    if (!pdfBytes) return false
    try {
      const doc = await PDFDocument.load(pdfBytes.slice())
      // Display position → index in the file
      const refDocIndex = after === 'end'
        ? (pageOrder[pageCount - 1] ?? pageCount - 1)
        : (pageOrder[after] ?? after)
      const ref = doc.getPage(Math.min(Math.max(refDocIndex, 0), doc.getPageCount() - 1))
      const size: [number, number] = [ref.getWidth(), ref.getHeight()]
      const insertAt = after === 'end' ? doc.getPageCount() : refDocIndex + 1

      if (insertAt >= doc.getPageCount()) doc.addPage(size)
      else doc.insertPage(insertAt, size)

      // Objects on pages at or after the insertion point move down one
      const { annotations } = useAnnotationsStore.getState()
      if (insertAt < doc.getPageCount() - 1) {
        useAnnotationsStore.setState({
          annotations: annotations.map(a =>
            a.pageIndex >= insertAt ? { ...a, pageIndex: a.pageIndex + 1 } : a),
        })
      }

      const saved = await doc.save()
      await loadPDF(saved.buffer as ArrayBuffer, { name: fileName, preserveAnnotations: true })
      addToast('עמוד נוסף', 'success')
      return true
    } catch (e) {
      console.error(e)
      addToast('שגיאה בהוספת עמוד', 'error')
      return false
    }
  }, [loadPDF, addToast])

  return { addBlankPage }
}
