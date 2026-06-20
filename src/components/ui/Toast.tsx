import React, { useEffect, useState } from 'react'
import { useUIStore } from '../../store'

type ToastType = 'info' | 'success' | 'error' | 'warning'

const CONFIG: Record<ToastType, { accent: string; bg: string; icon: React.ReactNode }> = {
  success: {
    accent: '#16a34a', bg: '#f0fdf4',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />,
  },
  error: {
    accent: '#dc2626', bg: '#fef2f2',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />,
  },
  warning: {
    accent: '#d97706', bg: '#fffbeb',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />,
  },
  info: {
    accent: '#000000', bg: '#ffffff',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
  },
}

const EASE = 'cubic-bezier(0.23,1,0.32,1)'

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useUIStore()
  return (
    <div className="toast-container no-print">
      {toasts.map(t => (
        <ToastItem key={t.id} id={t.id} message={t.message} type={t.type as ToastType} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  )
}

const ToastItem: React.FC<{ id: string; message: string; type: ToastType; onClose: () => void }> = ({ message, type, onClose }) => {
  const [leaving, setLeaving] = useState(false)
  const cfg = CONFIG[type] || CONFIG.info

  // Auto-dismiss handled by store; this only animates the exit on manual close
  const handleClose = () => {
    setLeaving(true)
    setTimeout(onClose, 180)
  }

  useEffect(() => {
    const timer = setTimeout(() => setLeaving(true), 3300)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      onClick={handleClose}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: cfg.bg,
        border: `1px solid ${cfg.accent}22`,
        borderInlineStart: `3px solid ${cfg.accent}`,
        color: 'var(--color-ink-black)',
        padding: '12px 16px 12px 14px',
        borderRadius: 14,
        fontSize: 13.5,
        fontWeight: 500,
        minWidth: 260,
        maxWidth: 420,
        cursor: 'pointer',
        boxShadow: '0 8px 30px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)',
        transform: leaving ? 'translateY(8px) scale(0.96)' : 'translateY(0) scale(1)',
        opacity: leaving ? 0 : 1,
        transition: `transform 220ms ${EASE}, opacity 200ms ease-out`,
        animation: leaving ? undefined : `toastEnter 0.28s ${EASE} both`,
      }}
    >
      <span style={{
        flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
        background: `${cfg.accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="16" height="16" fill="none" stroke={cfg.accent} strokeWidth="2.2" viewBox="0 0 24 24">
          {cfg.icon}
        </svg>
      </span>
      <span style={{ flex: 1, lineHeight: 1.4 }}>{message}</span>
    </div>
  )
}
