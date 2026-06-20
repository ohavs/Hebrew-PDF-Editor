import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePDFStore, useAnnotationsStore, useUIStore } from '../../store'
import { embedAnnotationsIntoPdf, downloadBlob } from '../../utils/pdfExport'

const EASE = 'cubic-bezier(0.23,1,0.32,1)'

export const MobileHeader: React.FC = () => {
  const { pdfDoc, pdfBytes, fileName, currentPage, pageCount, pageInfos, pageOrder } = usePDFStore()
  const { past } = useAnnotationsStore()
  const { addToast, darkMode, toggleDarkMode } = useUIStore()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!pdfBytes) return
    setSaving(true)
    try {
      const annotations = useAnnotationsStore.getState().annotations
      const formFields = useAnnotationsStore.getState().formFields
      const result = await embedAnnotationsIntoPdf(pdfBytes, annotations, formFields, pageInfos, pageOrder)
      downloadBlob(result, fileName.replace('.pdf', '') + '-edited.pdf')
      addToast('הורד בהצלחה', 'success')
    } catch {
      addToast('שגיאה בשמירה', 'error')
    } finally {
      setSaving(false)
    }
  }

  const hasUnsavedChanges = usePDFStore.getState().hasUnsavedChanges

  return (
    <div
      className="mobile-only no-print"
      style={{
        height: 52,
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 12px',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        flexShrink: 0,
        zIndex: 200,
        position: 'relative',
      }}
    >
      {/* Back */}
      <button
        onClick={() => navigate('/')}
        style={{
          width: 36, height: 36, borderRadius: 10, border: 'none',
          background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--color-text)', flexShrink: 0,
        }}
        onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-2)' }}
        onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
      >
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      </button>

      {/* File name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fileName || 'עורך PDF'}
        </div>
        {pdfDoc && (
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            {currentPage + 1} / {pageCount}
          </div>
        )}
      </div>

      {/* Unsaved dot */}
      {hasUnsavedChanges && (
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
      )}

      {/* Undo */}
      <HeaderBtn onClick={() => useAnnotationsStore.getState().undo()} disabled={!past.length}>
        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6M3 10l6-6" />
        </svg>
      </HeaderBtn>

      {/* Save/Download */}
      {pdfDoc && (
        <HeaderBtn onClick={save} disabled={saving}>
          {saving ? (
            <svg className="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          )}
        </HeaderBtn>
      )}

      {/* Dark mode toggle */}
      <HeaderBtn onClick={toggleDarkMode}>
        {darkMode ? (
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="5" /><path strokeLinecap="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        ) : (
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
          </svg>
        )}
      </HeaderBtn>
    </div>
  )
}

const HeaderBtn: React.FC<{ onClick: () => void; disabled?: boolean; children: React.ReactNode }> = ({ onClick, disabled, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      width: 36, height: 36, borderRadius: 10, border: 'none',
      background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: disabled ? 'not-allowed' : 'pointer', color: 'var(--color-text)',
      opacity: disabled ? 0.35 : 1, flexShrink: 0,
      transition: `opacity 150ms ease, transform 150ms ${EASE}`,
    }}
    onMouseDown={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.88)' }}
    onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
  >
    {children}
  </button>
)
