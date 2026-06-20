import React, { useRef, useEffect } from 'react'
import { usePDFStore } from '../../store'
import { usePDF } from '../../hooks/usePDF'

const EASE = 'cubic-bezier(0.23,1,0.32,1)'

interface Props { open: boolean; onClose: () => void }

export const MobilePagesSheet: React.FC<Props> = ({ open, onClose }) => {
  const { pdfDoc, pageCount, currentPage, setCurrentPage, pageOrder } = usePDFStore()
  const { renderThumbnail } = usePDF()

  if (!open || !pdfDoc) return null

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 510,
        background: 'var(--color-surface)',
        borderRadius: '24px 24px 0 0',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
        animation: `sheetIn 0.3s ${EASE} both`,
        paddingBottom: 'env(safe-area-inset-bottom, 16px)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-border)', margin: '12px auto 0' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 12px' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>דפים ({pageCount})</span>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'var(--color-surface-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text)' }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Horizontal page strip */}
        <div style={{ overflowX: 'auto', display: 'flex', gap: 12, padding: '0 16px 20px', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          {pageOrder.map((pageIdx, i) => (
            <PageThumb
              key={pageIdx}
              pdfDoc={pdfDoc}
              pageIndex={pageIdx}
              displayNum={i + 1}
              isCurrent={pageIdx === currentPage}
              renderThumbnail={renderThumbnail}
              onClick={() => { setCurrentPage(pageIdx); onClose() }}
            />
          ))}
        </div>
      </div>
    </>
  )
}

const PageThumb: React.FC<{
  pdfDoc: any; pageIndex: number; displayNum: number;
  isCurrent: boolean; renderThumbnail: any; onClick: () => void
}> = ({ pdfDoc, pageIndex, displayNum, isCurrent, renderThumbnail, onClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef.current) renderThumbnail(pdfDoc, pageIndex, canvasRef.current, 80)
  }, [pdfDoc, pageIndex, renderThumbnail])

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        border: 'none', background: 'transparent', cursor: 'pointer', flexShrink: 0,
        fontFamily: 'inherit',
      }}
    >
      <div style={{
        width: 80, borderRadius: 8, overflow: 'hidden',
        border: isCurrent ? '2.5px solid #000' : '2px solid var(--color-border)',
        boxShadow: isCurrent ? '0 4px 16px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.08)',
        background: 'white',
        transition: 'border-color 150ms ease, box-shadow 150ms ease',
      }}>
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? 'var(--color-ink-black)' : 'var(--color-text-muted)' }}>
        {displayNum}
      </span>
    </button>
  )
}
