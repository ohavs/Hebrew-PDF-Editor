import React from 'react'
import { usePDFStore } from '../../store'
import { PageListPanel } from '../panels/PageListPanel'

const EASE = 'cubic-bezier(0.32,0.72,0,1)'

interface Props { open: boolean; onClose: () => void }

/**
 * Vertical page manager: every page as a row with thumbnail, drag-to-reorder
 * handle and rotate/duplicate/delete actions. Tapping a row navigates to it.
 */
export const MobilePagesSheet: React.FC<Props> = ({ open, onClose }) => {
  const { pdfDoc, pageCount } = usePDFStore()

  if (!open || !pdfDoc) return null

  return (
    <>
      <div className="mobile-only no-print" onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }} />
      <div className="mobile-only no-print" role="dialog" aria-modal="true" aria-label="דפים" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 510,
        background: 'var(--color-surface)',
        borderRadius: '24px 24px 0 0',
        maxHeight: '82vh',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
        animation: `sheetIn 0.3s ${EASE} both`,
        display: 'flex', flexDirection: 'column',
        paddingBottom: 'env(safe-area-inset-bottom, 16px)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-border)', margin: '12px auto 0', flexShrink: 0 }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 10px', flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>דפים ({pageCount})</span>
          <button onClick={onClose} aria-label="סגור" style={{
            width: 36, height: 36, borderRadius: 10, border: 'none',
            background: 'var(--color-surface-2)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-text)', WebkitTapHighlightColor: 'transparent',
            minHeight: 0, padding: 0,
          }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', padding: '0 20px 10px', flexShrink: 0 }}>
          גרור מהידית לשינוי סדר · הקש על דף למעבר אליו
        </div>

        <div style={{ overflowY: 'auto', padding: '0 12px 16px', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          <PageListPanel onNavigate={onClose} />
        </div>
      </div>
    </>
  )
}
