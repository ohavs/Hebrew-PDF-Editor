import React from 'react'
import { useUIStore } from '../../store'

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useUIStore()
  if (!toasts.length) return null
  return (
    <div className="toast-container no-print">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`} onClick={() => removeToast(t.id)} style={{ cursor: 'pointer' }}>
          {t.message}
        </div>
      ))}
    </div>
  )
}
