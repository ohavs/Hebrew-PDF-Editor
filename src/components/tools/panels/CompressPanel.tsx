import React, { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { usePDFStore, useUIStore } from '../../../store'
import { downloadBlob } from '../../../utils/pdfExport'
import { useEditedBytes } from '../../../hooks/usePageOps'
import { askFileName } from '../../ui/PromptDialog'
import { Spinner, EmptyHint, InfoBar, PrimaryButton, renderPageCanvas, loadEditedForRender } from '../toolsShared'

export const CompressPanel: React.FC = () => {
  const { pdfDoc, fileName } = usePDFStore()
  const { addToast } = useUIStore()
  const [quality, setQuality] = useState(0.6)
  const [busy, setBusy] = useState(false)
  const getEdited = useEditedBytes()

  if (!pdfDoc) return <EmptyHint />

  const compress = async () => {
    const outName = await askFileName(`${fileName.replace(/\.pdf$/i, '')}-דחוס.pdf`, '.pdf')
    if (!outName) return
    setBusy(true)
    try {
      // Render the EDITED document so annotations/signatures are included
      const edited = await loadEditedForRender(getEdited)
      const out = await PDFDocument.create()
      const scale = quality < 0.5 ? 1.0 : 1.3
      for (let i = 1; i <= edited.numPages; i++) {
        const canvas = await renderPageCanvas(edited, i, scale)
        const jpeg = canvas.toDataURL('image/jpeg', quality)
        const bytes = Uint8Array.from(atob(jpeg.split(',')[1]), c => c.charCodeAt(0))
        const img = await out.embedJpg(bytes)
        const page = out.addPage([canvas.width, canvas.height])
        page.drawImage(img, { x: 0, y: 0, width: canvas.width, height: canvas.height })
      }
      edited.destroy()
      const saved = await out.save()
      downloadBlob(saved, outName)
      addToast(`הקובץ נדחס (${(saved.length / 1024 / 1024).toFixed(1)}MB)`, 'success')
    } catch (e) { console.error(e); addToast('שגיאה בקימפרוס', 'error') } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InfoBar text="הקימפרוס ממיר דפים לתמונות באיכות מבוקרת — אידיאלי למסמכים סרוקים. שים לב: טקסט הופך לתמונה." />
      <div>
        <label className="label">איכות: {Math.round(quality * 100)}%</label>
        <input type="range" min={0.3} max={0.9} step={0.1} value={quality}
          onChange={e => setQuality(parseFloat(e.target.value))} style={{ width: '100%' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
          <span>קובץ קטן</span><span>איכות גבוהה</span>
        </div>
      </div>
      <PrimaryButton onClick={compress} disabled={busy}>
        {busy ? <><Spinner /> דוחס…</> : 'דחוס והורד'}
      </PrimaryButton>
    </div>
  )
}
