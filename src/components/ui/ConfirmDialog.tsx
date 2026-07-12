import React, { useEffect } from 'react'
import { useUIStore } from '../../store'

const EASE = 'cubic-bezier(0.23,1,0.32,1)'

export const ConfirmDialog: React.FC = () => {
  const { confirmDialog, resolveConfirm } = useUIStore()
  const { open, title, message, confirmLabel, cancelLabel, danger } = confirmDialog

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resolveConfirm(false)
      if (e.key === 'Enter') resolveConfirm(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, resolveConfirm])

  if (!open) return null

  return (
    <div
      className="modal-overlay no-print"
      onClick={() => resolveConfirm(false)}
      style={{ zIndex: 2000 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)',
          borderRadius: 20,
          padding: '28px 28px 22px',
          width: 380,
          maxWidth: '90vw',
          boxShadow: '0 24px 80px rgba(0,0,0,0.30), 0 4px 16px rgba(0,0,0,0.10)',
          animation: `modalIn 0.25s ${EASE} both`,
          textAlign: 'center',
        }}
      >
        {/* Icon badge */}
        <div style={{
          width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: danger ? 'rgba(220,38,38,0.10)' : 'var(--color-mint)',
        }}>
          {danger ? (
            <svg width="26" height="26" fill="none" stroke="#dc2626" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          ) : (
            <svg width="26" height="26" fill="none" stroke="var(--color-ink-black)" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>

        <h3 style={{
          fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700,
          color: 'var(--color-ink-black)', margin: '0 0 8px', lineHeight: 1.2,
        }}>
          {title}
        </h3>

        {message && (
          <p style={{
            fontSize: 14, color: 'var(--color-text-muted)', margin: '0 0 22px',
            lineHeight: 1.5,
          }}>
            {message}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: message ? 0 : 12 }}>
          <DialogButton variant="ghost" onClick={() => resolveConfirm(false)}>
            {cancelLabel}
          </DialogButton>
          <DialogButton variant={danger ? 'danger' : 'primary'} onClick={() => resolveConfirm(true)} autoFocus>
            {confirmLabel}
          </DialogButton>
        </div>
      </div>
    </div>
  )
}

const DialogButton: React.FC<{
  variant: 'primary' | 'danger' | 'ghost'
  onClick: () => void
  autoFocus?: boolean
  children: React.ReactNode
}> = ({ variant, onClick, autoFocus, children }) => {
  const base: React.CSSProperties = {
    flex: 1, padding: '11px 16px', borderRadius: 12, fontSize: 14, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', border: 'none', outline: 'none',
    transition: `transform 150ms ${EASE}, background 150ms ease-out, filter 150ms ease-out`,
  }
  const styles: Record<string, React.CSSProperties> = {
    primary: { ...base, background: 'var(--color-accent)', color: 'var(--color-on-accent)' },
    danger: { ...base, background: '#dc2626', color: '#fff' },
    ghost: { ...base, background: 'var(--color-surface-2)', color: 'var(--color-text)' },
  }
  return (
    <button
      autoFocus={autoFocus}
      onClick={onClick}
      style={styles[variant]}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(0.93)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = '' }}
      onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)' }}
      onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
    >
      {children}
    </button>
  )
}
