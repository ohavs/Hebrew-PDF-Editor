import React, { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { usePDFStore, useUIStore } from '../../../store'
import { downloadBlob } from '../../../utils/pdfExport'
import { useEditedBytes } from '../../../hooks/usePageOps'
import { askFileName } from '../../ui/PromptDialog'
import { Spinner, EmptyHint, InfoBar, PrimaryButton, parseRanges } from '../toolsShared'

export const ExtractPanel: React.FC = () => {
  const { pdfDoc, pageCount, fileName } = usePDFStore()
  const { addToast } = useUIStore()
  const [range, setRange] = useState('')
  const [busy, setBusy] = useState(false)
  const getEdited = useEditedBytes()

  if (!pdfDoc) return <EmptyHint />

  const extract = async () => {
    const pages = parseRanges(range, pageCount)
    if (!pages.length) { addToast('הזן טווח דפים תקין', 'warning'); return }
    const extractName = await askFileName(`${fileName.replace(/\.pdf$/i, '')}-חילוץ.pdf`, '.pdf')
    if (!extractName) return
    setBusy(true)
    try {
      const src = await PDFDocument.load(await getEdited({ withDecorations: true }))
      const dest = await PDFDocument.create()
      const copied = await dest.copyPages(src, pages.map(p => p - 1))
      copied.forEach(p => dest.addPage(p))
      downloadBlob(await dest.save(), extractName)
      addToast(`${pages.length} דפים חולצו`, 'success')
    } catch { addToast('שגיאה בחילוץ', 'error') } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InfoBar text={`הזן אילו דפים לחלץ (1 עד ${pageCount}). לדוגמה: 1-3, 5, 8`} />
      <div>
        <label className="label">טווח דפים</label>
        <input
          className="input" value={range} onChange={e => setRange(e.target.value)}
          placeholder="לדוגמה: 1-3, 5" dir="ltr" inputMode="numeric"
          onFocus={e => setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)}
          style={{ width: '100%', textAlign: 'center', direction: 'ltr' }}
        />
      </div>
      <PrimaryButton onClick={extract} disabled={busy || !range.trim()}>
        {busy ? <><Spinner /> מחלץ…</> : 'חלץ דפים לקובץ חדש'}
      </PrimaryButton>
    </div>
  )
}
