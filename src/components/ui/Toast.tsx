import React, { useEffect, useState } from 'react'
import { useUIStore } from '../../store'

type ToastType = 'info' | 'success' | 'error' | 'warning'

const DOT: Record<ToastType, string> = {
  success: '#22c55e',
  error:   '#ef4444',
  warning: '#f59e0b',
  info:    '#60a5fa',
}

const ICON: Record<ToastType, React.ReactNode> = {
  success: <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />,
  error:   <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />,
  warning: <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01" />,
  info:    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01" />,
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
  const color = DOT[type] || DOT.info

  const dismiss = () => { setLeaving(true); setTimeout(onClose, 200) }

  useEffect(() => {
    const t = setTimeout(() => { setLeaving(true); setTimeout(onClose, 200) }, 3000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      onClick={dismiss}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'rgba(15, 15, 15, 0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: 'rgba(255,255,255,0.92)',
        padding: '10px 14px 10px 12px',
        borderRadius: 12,
        fontSize: 13,
        fontWeight: 500,
        minWidth: 200,
        maxWidth: 360,
        cursor: 'pointer',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        transform: leaving ? 'translateY(6px) scale(0.94)' : 'translateY(0) scale(1)',
        opacity: leaving ? 0 : 1,
        transition: `transform 200ms ${EASE}, opacity 180ms ease-out`,
        animation: leaving ? undefined : `toastEnter 0.26s ${EASE} both`,
      }}
    >
      {/* Colored icon circle */}
      <span style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        background: `${color}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1.5px solid ${color}55`,
      }}>
        <svg width="12" height="12" fill="none" stroke={color} strokeWidth="2.5" viewBox="0 0 24 24">
          {ICON[type]}
        </svg>
      </span>
      <span style={{ flex: 1, lineHeight: 1.4 }}>{message}</span>
    </div>
  )
}
