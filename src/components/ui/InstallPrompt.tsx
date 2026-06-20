import React, { useState } from 'react'
import { usePWAInstall } from '../../hooks/usePWAInstall'

const EASE = 'cubic-bezier(0.23,1,0.32,1)'

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
const isInStandaloneMode = () =>
  (window.navigator as any).standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches

export const InstallPrompt: React.FC = () => {
  const { canInstall, install } = usePWAInstall()
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('pwaInstallDismissed') === '1')

  const dismiss = () => {
    localStorage.setItem('pwaInstallDismissed', '1')
    setDismissed(true)
  }

  if (dismissed || isInStandaloneMode()) return null

  // iOS Safari: show "Add to Home Screen" instructions (beforeinstallprompt never fires on iOS)
  const showIOS = isIOS && !canInstall
  // Android Chrome: show native install button
  const showNative = canInstall

  if (!showIOS && !showNative) return null

  return (
    <div
      className="mobile-only no-print"
      style={{
        position: 'fixed',
        bottom: 'calc(var(--bottom-nav-height, 80px) + 12px)',
        left: 16, right: 16,
        zIndex: 450,
        background: 'rgba(10,10,14,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: 18,
        border: '1px solid rgba(255,255,255,0.1)',
        padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        animation: `sheetIn 0.4s ${EASE} both`,
      }}
    >
      {/* App icon */}
      <div style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
        background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="24" height="24" fill="none" stroke="white" strokeWidth="1.8" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.95)', marginBottom: 3 }}>
          {showIOS ? 'הוסף למסך הבית' : 'התקן את עורך ה-PDF'}
        </div>
        {showIOS ? (
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.45 }}>
            לחץ{' '}
            <svg width="13" height="13" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" viewBox="0 0 24 24" style={{ display: 'inline', verticalAlign: 'middle' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/>
            </svg>
            {' '}ואז <strong style={{ color: 'rgba(255,255,255,0.85)' }}>"הוסף למסך הבית"</strong>
          </div>
        ) : (
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)' }}>
            עבוד מהר יותר גם ללא אינטרנט
          </div>
        )}
      </div>

      {/* Install button (Android/Chrome) */}
      {showNative && (
        <button
          onClick={install}
          style={{
            padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: '#3b82f6', color: 'white', fontSize: 12.5, fontWeight: 700,
            fontFamily: 'inherit', flexShrink: 0,
            WebkitTapHighlightColor: 'transparent',
            transition: `transform 120ms ${EASE}`,
          }}
          onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.93)' }}
          onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
        >
          התקן
        </button>
      )}

      {/* Dismiss */}
      <button
        onClick={dismiss}
        style={{
          width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
          background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, WebkitTapHighlightColor: 'transparent',
        }}
      >
        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  )
}
