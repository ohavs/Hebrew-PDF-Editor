import React, { useEffect, useState } from 'react'
import { usePDFStore, useUIStore } from '../../../store'
import { usePDF } from '../../../hooks/usePDF'
import { downloadBlob } from '../../../utils/pdfExport'
import { askFileName } from '../../ui/PromptDialog'
import { marksOf, removeMarks, markLabel, type DocumentMark } from '../../../utils/documentMarks'
import { InfoBar, PrimaryButton, GhostButton, Spinner } from '../toolsShared'

/**
 * Marks the file arrived with — stamps, watermarks and notes.
 *
 * These are annotations rather than page content, which is why they behave so
 * oddly elsewhere in the editor: the text tools cannot see a word of them, and
 * one with no appearance stream is painted by nothing at all, so it is present
 * in the file and absent from the page. This is where they can be looked at
 * and taken out.
 */
export const MarksPanel: React.FC = () => {
  const { pdfDoc, pdfBytes, fileName } = usePDFStore()
  const { addToast } = useUIStore()
  const { loadPDF } = usePDF()
  const [marks, setMarks] = useState<DocumentMark[] | null>(null)
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    if (!pdfDoc || !pdfBytes) { setMarks([]); return }
    ;(async () => {
      try {
        const found = await marksOf(pdfDoc, pdfBytes)
        if (!live) return
        setMarks(found)
        setChosen(new Set(found.map(key)))
      } catch (e) {
        console.error(e)
        if (live) setMarks([])
      }
    })()
    return () => { live = false }
  }, [pdfDoc, pdfBytes])

  const toggle = (m: DocumentMark) => setChosen(prev => {
    const next = new Set(prev)
    next.has(key(m)) ? next.delete(key(m)) : next.add(key(m))
    return next
  })

  const selected = (marks || []).filter(m => chosen.has(key(m)))

  const apply = async (then: 'download' | 'open') => {
    if (!pdfBytes || !selected.length) return
    setBusy(true)
    try {
      const out = await removeMarks(pdfBytes, selected)
      if (then === 'open') {
        await loadPDF(out.slice().buffer as ArrayBuffer, { name: fileName || 'document.pdf' })
        addToast(`הוסרו ${selected.length} סימנים`, 'success')
        return
      }
      const outName = await askFileName(fileName || 'document.pdf', '.pdf')
      if (!outName) return
      downloadBlob(out, outName)
      addToast(`הוסרו ${selected.length} סימנים`, 'success')
    } catch (e) {
      console.error(e)
      addToast('שגיאה בהסרת הסימנים', 'error')
    } finally { setBusy(false) }
  }

  if (!pdfDoc) return <InfoBar text="פתח קובץ כדי לראות אילו סימנים הוא נושא." />
  if (marks === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 4 }}>
        <Spinner /> <span style={{ fontSize: 13 }}>סורק את הקובץ…</span>
      </div>
    )
  }

  if (!marks.length) {
    return (
      <InfoBar text="לא נמצאו חותמות, סימני מים או הערות שהגיעו עם הקובץ. אם יש כיתוב שאי אפשר לערוך, הוא כנראה חלק מתוכן העמוד עצמו ולא סימן נפרד — במקרה כזה אפשר לכסות אותו בעזרת תיבת טקסט או מלבן." />
    )
  }

  const invisible = marks.filter(m => !m.hasAppearance).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <InfoBar text="אלה סימנים שהגיעו בתוך הקובץ — הם אינם חלק מהטקסט של העמוד, ולכן כלי עריכת הטקסט לא מוצא אותם." />

      {invisible > 0 && (
        <div style={{
          fontSize: 12, lineHeight: 1.5, padding: '10px 12px', borderRadius: 10,
          background: 'var(--color-mint)', color: 'var(--color-ink-black)',
        }}>
          {invisible === marks.length ? 'כל הסימנים כאן' : `${invisible} מהסימנים`} לא
          מצוירים על הדף: הקובץ לא כולל עבורם מראה מוגדר, ולכן הם קיימים בקובץ אך אינם
          נראים. עורכים אחרים ממציאים להם מראה מהטקסט שלהם — ולכן שם הם נראים ואצלנו לא.
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <GhostButton onClick={() => setChosen(new Set(marks.map(key)))}>בחר הכל</GhostButton>
        <GhostButton onClick={() => setChosen(new Set())}>נקה בחירה</GhostButton>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
        {marks.map(m => (
          <label
            key={key(m)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '9px 11px', borderRadius: 10, cursor: 'pointer',
              border: '1px solid var(--color-border)',
              background: chosen.has(key(m)) ? 'var(--color-mint)' : 'transparent',
            }}
          >
            <input
              type="checkbox"
              checked={chosen.has(key(m))}
              onChange={() => toggle(m)}
              style={{ marginTop: 2 }}
            />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {markLabel(m)} · עמוד {m.pageIndex + 1}
                {!m.hasAppearance && (
                  <span style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}> · לא נראה בדף</span>
                )}
              </span>
              {m.contents && (
                <span style={{
                  fontSize: 11.5, color: 'var(--color-text-muted)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {m.contents}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <PrimaryButton onClick={() => apply('open')} disabled={busy || !selected.length}>
          {busy ? <><Spinner /> מסיר…</> : `הסר ${selected.length} ופתח בעורך`}
        </PrimaryButton>
        <GhostButton onClick={() => apply('download')} disabled={busy || !selected.length}>
          הסר והורד PDF
        </GhostButton>
      </div>
    </div>
  )
}

const key = (m: DocumentMark) => `${m.pageIndex}:${m.ref}`
