import React, { useState } from 'react'
import { usePDFStore } from '../../store'
import { useAuthoringPages } from '../../hooks/useAuthoringPages'

const EASE = 'cubic-bezier(0.23,1,0.32,1)'

/** Sits under the last page: one press adds another page of the same size. */
export const AddPageBar: React.FC = () => {
  const { pdfDoc, currentPage } = usePDFStore()
  const { addBlankPage } = useAuthoringPages()
  const [busy, setBusy] = useState(false)

  if (!pdfDoc) return null

  const run = (after: number | 'end') => async () => {
    if (busy) return
    setBusy(true)
    try { await addBlankPage(after) } finally { setBusy(false) }
  }

  const button = (label: string, onClick: () => void, primary = false): React.ReactNode => (
    <button
      onClick={onClick}
      disabled={busy}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '10px 16px', borderRadius: 12,
        border: primary ? 'none' : '1.5px dashed var(--color-border)',
        background: primary ? 'var(--color-accent)' : 'transparent',
        color: primary ? 'var(--color-on-accent)' : 'var(--color-text-muted)',
        fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
        cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1,
        transition: `background 140ms ${EASE}, color 140ms ${EASE}`,
        WebkitTapHighlightColor: 'transparent', minHeight: 0,
      }}
    >
      {label}
    </button>
  )

  return (
    <div
      data-add-page-bar
      style={{
        display: 'flex', justifyContent: 'center', gap: 8,
        padding: '4px 0 28px', flexWrap: 'wrap',
      }}
    >
      {button('＋ הוסף עמוד', run('end'), true)}
      {button('＋ עמוד אחרי הנוכחי', run(currentPage))}
    </div>
  )
}
