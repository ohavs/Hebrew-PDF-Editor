import React, { useState } from 'react'
import { usePWAInstall } from '../../hooks/usePWAInstall'

const EASE = 'cubic-bezier(0.23,1,0.32,1)'

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isInStandalone = () =>
  (window.navigator as any).standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches

/**
 * "Install app" entry point for the homepage: triggers the native prompt
 * where supported (Chrome/Edge/Android), or shows add-to-home-screen
 * instructions on iOS. Hidden once the app runs installed.
 */
export const InstallButton: React.FC = () => {
  const { canInstall, install } = usePWAInstall()
  const [showSheet, setShowSheet] = useState(false)

  if (isInStandalone()) return null

  return (
    <>
      <button
        onClick={() => { if (canInstall) { install() } else { setShowSheet(true) } }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'transparent',
          color: 'var(--color-graphite)',
          border: '1.5px solid var(--color-border)',
          borderRadius: 8,
          padding: '7px 14px',
          fontSize: 13.5,
          fontWeight: 500,
          cursor: 'pointer',
          letterSpacing: '-0.02em',
          fontFamily: 'var(--font-body)',
          transition: `border-color 150ms ease, transform 150ms ${EASE}`,
          WebkitTapHighlightColor: 'transparent',
          minHeight: 0,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-ink-black)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)' }}
        onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)' }}
        onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
      >
        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.5a6.5 6.5 0 100-13 6.5 6.5 0 000 13zM12 8v4m0 0l-2-2m2 2l2-2M8 21h8" />
        </svg>
        התקן אפליקציה
      </button>

      {showSheet && (
        <>
          <div
            onClick={() => setShowSheet(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
          />
          <div style={{
            position: 'fixed', zIndex: 710,
            bottom: 0, left: 0, right: 0,
            background: 'var(--color-surface)',
            borderRadius: '24px 24px 0 0',
            padding: '24px 24px calc(32px + env(safe-area-inset-bottom, 0px))',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
            animation: `sheetIn 0.3s ${EASE} both`,
            maxWidth: 480, margin: '0 auto',
            direction: 'rtl', textAlign: 'center',
            color: 'var(--color-text)',
          }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-border)', margin: '0 auto 20px' }} />
            <div style={{
              width: 64, height: 64, borderRadius: 18, margin: '0 auto 16px',
              background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="34" height="34" fill="none" stroke="white" strokeWidth="1.6" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>הוסף למסך הבית</div>
            {isIOS ? (
              <div style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.7, marginBottom: 20 }}>
                ב-Safari, לחץ על כפתור השיתוף{' '}
                <svg width="15" height="15" fill="none" stroke="var(--color-text)" strokeWidth="2" viewBox="0 0 24 24" style={{ display: 'inline', verticalAlign: 'middle', margin: '0 2px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/>
                </svg>
                {' '}ואז בחר <strong style={{ color: 'var(--color-text)' }}>"הוסף למסך הבית"</strong>
              </div>
            ) : (
              <div style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.7, marginBottom: 20 }}>
                בתפריט הדפדפן (⋮) בחר <strong style={{ color: 'var(--color-text)' }}>"התקן אפליקציה"</strong> או "הוסף למסך הבית"
              </div>
            )}
            <button
              onClick={() => setShowSheet(false)}
              style={{
                width: '100%', padding: 13, borderRadius: 14, border: '1px solid var(--color-border)',
                background: 'var(--color-surface-2)', color: 'var(--color-text)',
                fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              הבנתי
            </button>
          </div>
        </>
      )}
    </>
  )
}
