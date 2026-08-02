import React, { useState } from 'react'
import { usePDFStore, useUIStore } from '../../../store'
import { EmptyHint, InfoBar, PrimaryButton, GhostButton } from '../toolsShared'

export const WatermarkPanel: React.FC = () => {
  const { pdfDoc, watermark, setWatermark } = usePDFStore()
  const { addToast } = useUIStore()
  const [text, setText] = useState(watermark?.text ?? 'טיוטה')
  const [opacity, setOpacity] = useState(watermark?.opacity ?? 0.2)
  const [fontSize, setFontSize] = useState(watermark?.fontSize ?? 80)

  if (!pdfDoc) return <EmptyHint />

  const apply = () => {
    if (!text.trim()) { addToast('הזן טקסט לסימן המים', 'warning'); return }
    setWatermark({
      text: text.trim(), fontSize, opacity,
      dx: watermark?.dx ?? 0, dy: watermark?.dy ?? 0,
    })
    addToast(watermark ? 'סימן המים עודכן' : 'סימן המים נוסף — גרור אותו על הדף למיקום אחר', 'success')
  }

  const remove = () => {
    setWatermark(null)
    addToast('סימן המים הוסר', 'success')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InfoBar text="סימן המים מוצג על כל הדפים כשכבה חיה: אפשר לגרור אותו, לעדכן או להסיר בכל רגע. הוא נטבע בקובץ רק בשמירה." />
      <div>
        <label className="label">טקסט סימן המים</label>
        <input className="input" value={text} onChange={e => setText(e.target.value)}
          placeholder="לדוגמה: טיוטה, סודי, DRAFT" style={{ width: '100%' }} />
      </div>
      <div>
        <label className="label">גודל: {fontSize}px</label>
        <input type="range" min={40} max={160} step={10} value={fontSize}
          onChange={e => setFontSize(parseInt(e.target.value))} style={{ width: '100%' }} />
      </div>
      <div>
        <label className="label">שקיפות: {Math.round(opacity * 100)}%</label>
        <input type="range" min={0.05} max={0.5} step={0.05} value={opacity}
          onChange={e => setOpacity(parseFloat(e.target.value))} style={{ width: '100%' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
          <span>שקוף יותר</span><span>בולט יותר</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <PrimaryButton onClick={apply} disabled={!text.trim()}>
          {watermark ? 'עדכן סימן מים' : 'הוסף סימן מים'}
        </PrimaryButton>
        {watermark && (
          <GhostButton onClick={remove}>הסר</GhostButton>
        )}
      </div>
    </div>
  )
}
