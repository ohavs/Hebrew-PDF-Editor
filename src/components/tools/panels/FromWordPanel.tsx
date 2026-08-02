import React, { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { useUIStore, useAnnotationsStore } from '../../../store'
import type { TextBoxAnnotation } from '../../../store/types'
import { usePDF } from '../../../hooks/usePDF'
import { downloadBlob } from '../../../utils/pdfExport'
import { askFileName } from '../../ui/PromptDialog'
import { parseDocx, renderParagraphsToPages, layoutParagraphsToBoxes } from '../../../utils/wordConvert'
import { Spinner, InfoBar, FilePicker, FileRow, PrimaryButton, GhostButton } from '../toolsShared'

/** Both conversion paths fail the same way — say which way in Hebrew. */
function conversionError(e: any): string {
  return e?.message === 'LEGACY_DOC'
    ? 'זהו קובץ .doc ישן — שמור אותו כ-DOCX בוורד ונסה שוב'
    : e?.message === 'NOT_DOCX'
    ? 'הקובץ אינו DOCX תקין'
    : 'שגיאה בהמרה מוורד — נסה לרענן את הדף'
}

export const FromWordPanel: React.FC = () => {
  const { addToast } = useUIStore()
  const { loadPDF } = usePDF()
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  /**
   * Open-in-editor: every Word paragraph becomes a LIVE TextBox annotation
   * on blank pages — tap any paragraph to edit the words, drag to move,
   * restyle with the text tool. As close to editing the original Word
   * document as a PDF editor gets.
   */
  const convertToEditable = async () => {
    if (!file) return
    setBusy(true)
    try {
      const paras = parseDocx(new Uint8Array(await file.arrayBuffer()))
      if (!paras.some(p => p.text.trim() && p.text !== '\f')) {
        addToast('לא נמצא טקסט בקובץ', 'warning')
        return
      }
      const { pageCount, boxes } = layoutParagraphsToBoxes(paras)

      const doc = await PDFDocument.create()
      for (let i = 0; i < pageCount; i++) doc.addPage([595, 842])
      const saved = await doc.save()
      const name = file.name.replace(/\.docx?$/i, '') + '.pdf'
      const loaded = await loadPDF(saved.buffer as ArrayBuffer, { name })
      if (!loaded) return

      const { addAnnotation } = useAnnotationsStore.getState()
      boxes.forEach(b => {
        const tb: Omit<TextBoxAnnotation, 'id' | 'createdAt'> = {
          type: 'textbox',
          pageIndex: b.pageIndex,
          rect: { x: b.x, y: b.y, width: b.width, height: b.height },
          content: b.text,
          fontFamily: 'Heebo',
          fontSize: 12,
          fontWeight: 'normal',
          fontStyle: 'normal',
          textDecoration: 'none',
          color: '#111111',
          align: b.rtl ? 'right' : 'left',
          direction: b.rtl ? 'rtl' : 'ltr',
        }
        addAnnotation(tb)
      })
      useAnnotationsStore.getState().selectAnnotation(null)
      setFile(null)
      addToast('המסמך נפתח לעריכה — הקש על כל פסקה כדי לערוך אותה', 'success')
      window.location.hash = '#/editor'
    } catch (e: any) {
      console.error(e)
      addToast(conversionError(e), 'error')
    } finally { setBusy(false) }
  }

  /** Download: rasterized pages (fixed layout, not editable). */
  const convertToDownload = async () => {
    if (!file) return
    setBusy(true)
    try {
      const paras = parseDocx(new Uint8Array(await file.arrayBuffer()))
      if (!paras.some(p => p.text.trim() && p.text !== '\f')) {
        addToast('לא נמצא טקסט בקובץ', 'warning')
        return
      }
      const pageImages = renderParagraphsToPages(paras)
      const doc = await PDFDocument.create()
      for (const dataUrl of pageImages) {
        const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0))
        const img = await doc.embedPng(bytes)
        const page = doc.addPage([595, 842])
        page.drawImage(img, { x: 0, y: 0, width: 595, height: 842 })
      }
      const saved = await doc.save()
      const defaultName = file.name.replace(/\.docx?$/i, '') + '.pdf'
      const outName = await askFileName(defaultName, '.pdf')
      if (outName) {
        downloadBlob(saved, outName)
        addToast('קובץ PDF ירד בהצלחה', 'success')
        setFile(null)
      }
    } catch (e: any) {
      console.error(e)
      addToast(conversionError(e), 'error')
    } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InfoBar text="״פתח לעריכה״ הופך כל פסקה לטקסט חי בעורך — אפשר לערוך מילים, להזיז ולעצב, ממש כמו בוורד. ״הורד PDF״ מייצר קובץ סופי בפריסה קבועה." />
      <FilePicker accept=".docx" label="בחר קובץ Word" onPick={fs => setFile(fs[0] || null)} />
      {file && <FileRow name={file.name} size={file.size} onRemove={() => setFile(null)} />}
      <div style={{ display: 'flex', gap: 10 }}>
        <PrimaryButton onClick={convertToEditable} disabled={busy || !file}>
          {busy ? <><Spinner /> ממיר…</> : 'המר ופתח לעריכה'}
        </PrimaryButton>
        <GhostButton onClick={convertToDownload} disabled={busy || !file}>
          הורד PDF
        </GhostButton>
      </div>
    </div>
  )
}
