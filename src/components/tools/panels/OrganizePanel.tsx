import React, { useState } from 'react'
import { usePDFStore } from '../../../store'
import { usePageOps } from '../../../hooks/usePageOps'
import { PageListPanel } from '../../panels/PageListPanel'
import { Spinner, EmptyHint, InfoBar } from '../toolsShared'

export const OrganizePanel: React.FC = () => {
  const { pdfDoc, currentPage, pageCount, pageOrder, pageInfos } = usePDFStore()
  const { addBlankAfter, rotateAllPages } = usePageOps()
  const [busy, setBusy] = useState(false)

  if (!pdfDoc) return <EmptyHint />

  const run = (fn: () => Promise<unknown>) => async () => {
    if (busy) return
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  const displayPos = Math.max(0, pageOrder.indexOf(currentPage))
  const info = pageInfos[currentPage]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <InfoBar text={`${pageCount} דפים. גרור מהידית לשינוי סדר, או השתמש בכפתורי השורה.`} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} disabled={busy}
          onClick={run(rotateAllPages)}>⟳ סובב הכל</button>
        <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} disabled={busy}
          onClick={run(() => addBlankAfter(displayPos, info ? [info.width, info.height] : undefined))}>＋ דף ריק</button>
      </div>
      <PageListPanel />
      {busy && <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)' }}><Spinner /> מעבד…</div>}
    </div>
  )
}
