import React, { useState } from 'react'
import { usePDFStore, useUIStore } from '../../../store'
import { triggerDownload } from '../../../utils/pdfExport'
import { useEditedBytes } from '../../../hooks/usePageOps'
import {
  Spinner, EmptyHint, InfoBar, SegmentedControl, PrimaryButton,
  renderPageCanvas, loadEditedForRender, parseRanges,
} from '../toolsShared'

export const ToImagePanel: React.FC = () => {
  const { pdfDoc, pageCount, currentPage, pageOrder, fileName } = usePDFStore()
  const { addToast } = useUIStore()
  const [format, setFormat] = useState<'png' | 'jpeg'>('png')
  const [scope, setScope] = useState<'current' | 'all' | 'custom'>('all')
  const [customRange, setCustomRange] = useState('')
  const [busy, setBusy] = useState(false)
  const getEdited = useEditedBytes()

  if (!pdfDoc) return <EmptyHint />

  const currentDisplayNum = Math.max(0, pageOrder.indexOf(currentPage)) + 1

  const exportImages = async () => {
    setBusy(true)
    try {
      const base = fileName.replace(/\.pdf$/i, '')
      const pages = scope === 'current' ? [currentDisplayNum]
        : scope === 'custom' ? parseRanges(customRange, pageCount)
        : Array.from({ length: pageCount }, (_, i) => i + 1)
      if (!pages.length) { addToast('הזן טווח דפים תקין', 'warning'); setBusy(false); return }
      // Render the EDITED document so annotations/signatures are included
      const edited = await loadEditedForRender(getEdited)
      for (const num of pages) {
        const canvas = await renderPageCanvas(edited, num, 2)
        const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, `image/${format}`, 0.92))
        if (blob) triggerDownload(blob, `${base}-עמוד-${num}.${format === 'jpeg' ? 'jpg' : 'png'}`)
        await new Promise(r => setTimeout(r, 250))
      }
      edited.destroy()
      addToast(`${pages.length} תמונות יוצאו`, 'success')
    } catch (e) { console.error(e); addToast('שגיאה בייצוא תמונות', 'error') } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InfoBar text="ייצא דפי PDF כקבצי תמונה ברזולוציה גבוהה." />
      <SegmentedControl
        label="פורמט"
        value={format}
        options={[{ value: 'png', label: 'PNG' }, { value: 'jpeg', label: 'JPG' }]}
        onChange={v => setFormat(v as 'png' | 'jpeg')}
      />
      <SegmentedControl
        label="טווח"
        value={scope}
        options={[
          { value: 'all', label: `כל (${pageCount})` },
          { value: 'current', label: `נוכחי (${currentDisplayNum})` },
          { value: 'custom', label: 'בחירה ידנית' },
        ]}
        onChange={v => setScope(v as 'current' | 'all' | 'custom')}
      />
      {scope === 'custom' && (
        <input
          className="input"
          value={customRange}
          onChange={e => setCustomRange(e.target.value)}
          placeholder="לדוגמה: 1-3, 5, 8"
          dir="ltr"
          inputMode="numeric"
          onFocus={e => setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)}
          style={{ width: '100%', textAlign: 'center' }}
        />
      )}
      <PrimaryButton onClick={exportImages} disabled={busy}>
        {busy ? <><Spinner /> מייצא…</> : 'ייצא תמונות'}
      </PrimaryButton>
    </div>
  )
}
