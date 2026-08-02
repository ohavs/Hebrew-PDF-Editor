import React, { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { usePDFStore, useUIStore } from '../../../store'
import { usePDF } from '../../../hooks/usePDF'
import { downloadBlob } from '../../../utils/pdfExport'
import { InfoBar, FilePicker, FileRow, PrimaryButton, GhostButton, Spinner } from '../toolsShared'

export const FromImagePanel: React.FC = () => {
  const { pdfDoc } = usePDFStore()
  const { addToast } = useUIStore()
  const { loadPDF } = usePDF()
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)

  const build = async (mode: 'new' | 'append') => {
    if (!files.length) return
    setBusy(true)
    try {
      const doc = mode === 'append' && pdfDoc
        ? await PDFDocument.load(usePDFStore.getState().pdfBytes!.slice())
        : await PDFDocument.create()
      for (const f of files) {
        const bytes = new Uint8Array(await f.arrayBuffer())
        const img = f.type.includes('png') ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
        const page = doc.addPage([img.width, img.height])
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height })
      }
      const saved = await doc.save()
      if (mode === 'append') { await loadPDF(saved.buffer as ArrayBuffer, { name: usePDFStore.getState().fileName }); addToast('התמונות נוספו למסמך', 'success') }
      else { downloadBlob(saved, 'תמונות.pdf'); addToast('נוצר PDF מהתמונות', 'success') }
      setFiles([])
    } catch { addToast('שגיאה ביצירת PDF', 'error') } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InfoBar text="בחר תמונות (PNG / JPG) — כל תמונה תהפוך לדף ב-PDF." />
      <FilePicker accept="image/png,image/jpeg" multiple label="בחר תמונות" onPick={fs => setFiles(prev => [...prev, ...fs])} />
      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {files.map((f, i) => (
            <FileRow key={i} name={f.name} size={f.size} onRemove={() => setFiles(prev => prev.filter((_, j) => j !== i))} />
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        <PrimaryButton onClick={() => build('new')} disabled={busy || !files.length}>
          {busy ? <><Spinner /> יוצר…</> : 'צור PDF חדש'}
        </PrimaryButton>
        {pdfDoc && (
          <GhostButton onClick={() => build('append')} disabled={busy || !files.length}>
            הוסף למסמך הנוכחי
          </GhostButton>
        )}
      </div>
    </div>
  )
}
