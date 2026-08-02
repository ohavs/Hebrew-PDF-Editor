import React, { useState } from 'react'
import { usePDFStore, useUIStore } from '../../../store'
import { EmptyHint, InfoBar, SegmentedControl, PrimaryButton, GhostButton } from '../toolsShared'

export const PageNumbersPanel: React.FC = () => {
  const { pdfDoc, pageNumbers, setPageNumbers } = usePDFStore()
  const { addToast } = useUIStore()
  const [position, setPosition] = useState<'center' | 'right' | 'left'>(pageNumbers?.position ?? 'center')
  const [startAt, setStartAt] = useState(String(pageNumbers?.startAt ?? 1))

  if (!pdfDoc) return <EmptyHint />

  const apply = () => {
    setPageNumbers({
      position,
      startAt: parseInt(startAt) || 1,
      dx: pageNumbers?.dx ?? 0,
      dy: pageNumbers?.dy ?? 0,
    })
    addToast(pageNumbers ? 'המספור עודכן' : 'המספור נוסף — גרור אותו על הדף למיקום מדויק', 'success')
  }

  const remove = () => {
    setPageNumbers(null)
    addToast('המספור הוסר', 'success')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InfoBar text="המספור מוצג כשכבה חיה: אפשר לגרור, לעדכן או להסיר בכל רגע. נטבע בקובץ רק בשמירה." />
      <SegmentedControl
        label="מיקום"
        value={position}
        options={[
          { value: 'center', label: 'מרכז' },
          { value: 'right', label: 'ימין' },
          { value: 'left', label: 'שמאל' },
        ]}
        onChange={v => setPosition(v as 'center' | 'right' | 'left')}
      />
      <div>
        <label className="label">התחל ממספר</label>
        <input
          className="input" value={startAt} onChange={e => setStartAt(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric" dir="ltr" style={{ width: '100%', textAlign: 'center' }}
        />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <PrimaryButton onClick={apply}>
          {pageNumbers ? 'עדכן מספור' : 'הוסף מספרי עמודים'}
        </PrimaryButton>
        {pageNumbers && (
          <GhostButton onClick={remove}>הסר</GhostButton>
        )}
      </div>
    </div>
  )
}
