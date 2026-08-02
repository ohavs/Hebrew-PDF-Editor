import React from 'react'
import { useAnnotationsStore, usePDFStore } from '../../store'
import type { Annotation } from '../../store/types'
import { format } from 'date-fns'

const ANNOTATION_TYPE_LABELS: Record<string, string> = {
  highlight: '✏️ הדגשה',
  underline: '__ קו תחתון',
  strikethrough: '~~ חוצה',
  draw: '🖊️ ציור',
  shape: '⬜ צורה',
  textbox: '📝 טקסט',
  sticky: '📌 פתק',
  stamp: '🔴 חותמת',
  signature: '✍️ חתימה'
}

export const AnnotationsPanel: React.FC = () => {
  const { annotations, deleteAnnotation, selectAnnotation, selectedId, deleteAllOnPage } = useAnnotationsStore()
  const { currentPage, setCurrentPage } = usePDFStore()

  if (!annotations.length) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
        <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ margin: '0 auto 8px', opacity: 0.4 }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
        אין הערות
      </div>
    )
  }

  // Group by page
  const byPage = annotations.reduce<Record<number, Annotation[]>>((acc, ann) => {
    if (!acc[ann.pageIndex]) acc[ann.pageIndex] = []
    acc[ann.pageIndex].push(ann)
    return acc
  }, {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>
          הערות ({annotations.length})
        </span>
        <button
          className="btn btn-ghost"
          style={{ fontSize: 11, padding: '2px 6px', color: 'var(--color-danger)' }}
          onClick={() => deleteAllOnPage(currentPage)}
          title="מחק הכל"
        >
          מחק הכל
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {Object.entries(byPage).sort(([a],[b]) => +a - +b).map(([pageIdx, anns]) => (
          <div key={pageIdx}>
            <div style={{ padding: '6px 12px', background: 'var(--color-surface-2)', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
              דף {+pageIdx + 1}
            </div>
            {anns.map(ann => (
              <div
                key={ann.id}
                className="annotation-list-item"
                style={{ background: selectedId === ann.id ? 'rgba(37,99,235,0.06)' : undefined }}
                onClick={() => {
                  selectAnnotation(ann.id)
                  setCurrentPage(ann.pageIndex)
                }}
              >
                <div style={{ fontSize: 13, flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, marginBottom: 2 }}>
                    {ANNOTATION_TYPE_LABELS[ann.type] || ann.type}
                  </div>
                  {'content' in ann && ann.content && (
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(ann as any).content}
                    </div>
                  )}
                  {'text' in ann && (ann as any).text && (
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {(ann as any).text}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {format(new Date(ann.createdAt), 'dd/MM/yyyy HH:mm')}
                    {ann.author && ` · ${ann.author}`}
                  </div>
                </div>
                <button
                  className="btn-icon"
                  aria-label="מחק הערה"
                  style={{ width: 24, height: 24, color: 'var(--color-danger)', flexShrink: 0 }}
                  onClick={e => { e.stopPropagation(); deleteAnnotation(ann.id) }}
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
