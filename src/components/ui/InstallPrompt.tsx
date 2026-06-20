import React, { useState } from 'react'
import { usePWAInstall } from '../../hooks/usePWAInstall'

const EASE = 'cubic-bezier(0.23,1,0.32,1)'

export const InstallPrompt: React.FC = () => {
  const { canInstall, install } = usePWAInstall()
  const [dismissed, setDismissed] = useState(false)

  if (!canInstall || dismissed) return null

  return (
    <div
      className="mobile-only"
      style={{
        position: 'fixed', bottom: 80, left: 12, right: 12,
        background: 'rgba(15,15,15,0.92)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderRadius: 20, padding: '16px 20px',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
        zIndex: 600, display: 'flex', alignItems: 'center', gap: 14,
        animation: `sheetIn 0.4s ${EASE} both`,
      }}
    >
      {/* App icon */}
      <img src="/icons/icon-192.png" alt="PDF Editor" style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0 }} />

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 2 }}>התקן את האפליקציה</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>עבוד מהר יותר גם ללא אינטרנט</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        <button
          onClick={install}
          style={{
            padding: '8px 16px', borderRadius: 10, border: 'none',
            background: '#d1ffca', color: '#000', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            transition: `transform 150ms ${EASE}`,
          }}
          onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.95)' }}
          onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
        >
          התקן
        </button>
        <button
          onClick={() => setDismissed(true)}
          style={{
            padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
            background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 11,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          אחר כך
        </button>
      </div>
    </div>
  )
}
