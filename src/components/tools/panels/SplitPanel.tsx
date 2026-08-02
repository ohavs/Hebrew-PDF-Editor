import React, { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { usePDFStore, useUIStore } from '../../../store'
import { downloadBlob } from '../../../utils/pdfExport'
import { useEditedBytes } from '../../../hooks/usePageOps'
import { Spinner, EmptyHint, InfoBar, SegmentedControl, PrimaryButton, parseRanges } from '../toolsShared'

export const SplitPanel: React.FC = () => {
  const { pdfDoc, pageCount, fileName } = usePDFStore()
  const { addToast } = useUIStore()
  const [busy, setBusy] = useState(false)
  const [splitMode, setSplitMode] = useState<'each' | 'ranges'>('each')
  const [splitRanges, setSplitRanges] = useState('')
  const getEdited = useEditedBytes()

  if (!pdfDoc) return <EmptyHint />

  const splitEach = async () => {
    setBusy(true)
    try {
      const src = await PDFDocument.load(await getEdited({ withDecorations: true }))
      const baseName = fileName.replace(/\.pdf$/i, '')
      for (let i = 0; i < pageCount; i++) {
        const dest = await PDFDocument.create()
        const [pg] = await dest.copyPages(src, [i])
        dest.addPage(pg)
        downloadBlob(await dest.save(), `${baseName}-עמוד-${i + 1}.pdf`)
        await new Promise(r => setTimeout(r, 250))
      }
      addToast(`המסמך פוצל ל-${pageCount} קבצים`, 'success')
    } catch { addToast('שגיאה בפיצול', 'error') } finally { setBusy(false) }
  }

  const splitByRanges = async () => {
    // Parse comma-separated groups like "1-3, 4-6, 7"
    const groups = splitRanges.split(',').map(g => g.trim()).filter(Boolean)
    if (!groups.length) { addToast('הזן טווחים תקינים', 'warning'); return }
    setBusy(true)
    try {
      const src = await PDFDocument.load(await getEdited({ withDecorations: true }))
      const baseName = fileName.replace(/\.pdf$/i, '')
      for (let gi = 0; gi < groups.length; gi++) {
        const pages = parseRanges(groups[gi], pageCount)
        if (!pages.length) continue
        const dest = await PDFDocument.create()
        const copied = await dest.copyPages(src, pages.map(p => p - 1))
        copied.forEach(p => dest.addPage(p))
        downloadBlob(await dest.save(), `${baseName}-חלק-${gi + 1}.pdf`)
        await new Promise(r => setTimeout(r, 250))
      }
      addToast(`המסמך פוצל ל-${groups.length} קבצים`, 'success')
    } catch { addToast('שגיאה בפיצול', 'error') } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InfoBar text={`המסמך (${pageCount} דפים) יפוצל לקבצי PDF נפרדים.`} />
      <SegmentedControl
        label="מצב פיצול"
        value={splitMode}
        options={[{ value: 'each', label: 'דף לכל קובץ' }, { value: 'ranges', label: 'טווחים מותאמים' }]}
        onChange={v => setSplitMode(v as 'each' | 'ranges')}
      />
      {splitMode === 'ranges' && (
        <div>
          <label className="label">טווחים (מופרדים בפסיק)</label>
          <input
            className="input"
            value={splitRanges}
            onChange={e => setSplitRanges(e.target.value)}
            placeholder="לדוגמה: 1-3, 4-6, 7"
            dir="ltr"
            inputMode="numeric"
            onFocus={e => setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)}
            style={{ width: '100%', textAlign: 'center' }}
          />
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
            כל קבוצה תהפוך לקובץ נפרד
          </div>
        </div>
      )}
      <PrimaryButton onClick={splitMode === 'each' ? splitEach : splitByRanges} disabled={busy}>
        {busy ? <><Spinner /> מפצל…</> : splitMode === 'each' ? `פצל ל-${pageCount} קבצים נפרדים` : 'פצל לפי טווחים'}
      </PrimaryButton>
    </div>
  )
}
