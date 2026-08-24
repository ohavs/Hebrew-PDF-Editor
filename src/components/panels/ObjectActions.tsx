import React from 'react'
import { useAnnotationsStore } from '../../store'

/**
 * Actions for whatever object is selected — stacking, duplicating, deleting.
 * Keyboard shortcuts exist for all of these, but a layout tool that only
 * offers them from the keyboard is a layout tool half the users can't use.
 */
export const ObjectActions: React.FC = () => {
  const { selectedId, reorderAnnotation, duplicateAnnotation, deleteAnnotation, pushHistory, annotations } = useAnnotationsStore()
  if (!selectedId) return null
  const selected = annotations.find(a => a.id === selectedId)
  if (!selected) return null

  const act = (fn: () => void) => () => { pushHistory(); fn() }

  const buttons: Array<{ label: string; title: string; icon: string; onClick: () => void; danger?: boolean }> = [
    { label: 'לחזית', title: 'הבא לחזית (Ctrl+Shift+])', icon: '⤒', onClick: act(() => reorderAnnotation(selectedId, 'front')) },
    { label: 'קדימה', title: 'קדם שכבה אחת (Ctrl+])', icon: '↑', onClick: act(() => reorderAnnotation(selectedId, 'forward')) },
    { label: 'אחורה', title: 'אחור שכבה אחת (Ctrl+[)', icon: '↓', onClick: act(() => reorderAnnotation(selectedId, 'backward')) },
    { label: 'לרקע', title: 'שלח לרקע (Ctrl+Shift+[)', icon: '⤓', onClick: act(() => reorderAnnotation(selectedId, 'back')) },
    { label: 'שכפל', title: 'שכפל (Ctrl+D)', icon: '⧉', onClick: act(() => duplicateAnnotation(selectedId)) },
    { label: 'מחק', title: 'מחק (Delete)', icon: '🗑', onClick: act(() => deleteAnnotation(selectedId)), danger: true },
  ]

  return (
    <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-border)' }}>
      <div className="panel-title" style={{ marginBottom: 8 }}>האובייקט הנבחר</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {buttons.map(b => (
          <button
            key={b.label}
            onClick={b.onClick}
            title={b.title}
            aria-label={b.title}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 9px', borderRadius: 9, cursor: 'pointer',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface-2)',
              color: b.danger ? 'var(--color-danger)' : 'var(--color-text)',
              fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit', minHeight: 0,
            }}
          >
            <span aria-hidden style={{ fontSize: 12 }}>{b.icon}</span>
            {b.label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', marginTop: 6 }}>
        חיצים מזיזים בנקודה, עם Shift בעשר
      </div>
    </div>
  )
}
