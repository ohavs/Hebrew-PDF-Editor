import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePDFStore, useAnnotationsStore, useUIStore } from '../../store'
import { embedAnnotationsIntoPdf, shareOrDownload } from '../../utils/pdfExport'
import { usePWAInstall } from '../../hooks/usePWAInstall'

const EASE = 'cubic-bezier(0.23,1,0.32,1)'

// iPadOS 13+ reports a macOS user agent — detect via touch points
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isInStandalone = () =>
  (window.navigator as any).standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches

export const MobileHeader: React.FC = () => {
  const { pdfDoc, pdfBytes, fileName, currentPage, pageCount, pageInfos, pageOrder, hasUnsavedChanges } = usePDFStore()
  const { past } = useAnnotationsStore()
  const { addToast, darkMode, toggleDarkMode, searchOpen, setSearchOpen } = useUIStore()
  const { canInstall, install } = usePWAInstall()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [showInstall, setShowInstall] = useState(false)

  const dismissed = localStorage.getItem('pwaInstallDismissed') === '1'
  const showInstallBtn = !dismissed && !isInStandalone()

  const save = async () => {
    if (!pdfBytes) return
    setSaving(true)
    try {
      const annotations = useAnnotationsStore.getState().annotations
      const formFields = useAnnotationsStore.getState().formFields
      const { watermark, pageNumbers } = usePDFStore.getState()
      const result = await embedAnnotationsIntoPdf(pdfBytes, annotations, formFields, pageInfos, pageOrder, { watermark, pageNumbers })
      const outcome = await shareOrDownload(result, fileName.replace('.pdf', '') + '-edited.pdf')
      addToast(outcome === 'shared' ? 'הקובץ מוכן לשיתוף' : 'הורד בהצלחה', 'success')
    } catch (e) {
      console.error(e)
      addToast('שגיאה בשמירה', 'error')
    } finally {
      setSaving(false)
    }
  }

  const hasUnsaved = hasUnsavedChanges

  return (
    <>
      <div
        className="mobile-only no-print"
        style={{
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '0 10px',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          height: 'calc(52px + env(safe-area-inset-top, 0px))',
          flexShrink: 0,
          zIndex: 200,
          position: 'relative',
        }}
      >
        {/* Back */}
        <HeaderBtn ariaLabel="דף הבית" onClick={() => navigate('/')}>
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </HeaderBtn>

        {/* File name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {fileName || 'עורך PDF'}
          </div>
          {pdfDoc && (
            <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
              עמ׳ {currentPage + 1}/{pageCount}
            </div>
          )}
        </div>

        {/* Unsaved dot */}
        {hasUnsaved && (
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
        )}

        {/* Search */}
        {pdfDoc && (
          <HeaderBtn ariaLabel="חיפוש" onClick={() => setSearchOpen(!searchOpen)}>
            <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
            </svg>
          </HeaderBtn>
        )}

        {/* Undo */}
        <HeaderBtn ariaLabel="בטל" onClick={() => useAnnotationsStore.getState().undo()} disabled={!past.length}>
          <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6M3 10l6-6" />
          </svg>
        </HeaderBtn>

        {/* Save / Share */}
        {pdfDoc && (
          <HeaderBtn ariaLabel="שמור ושתף" onClick={save} disabled={saving}>
            {saving ? (
              <svg className="spinner" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
          </HeaderBtn>
        )}

        {/* Dark mode toggle */}
        <HeaderBtn ariaLabel={darkMode ? 'מצב בהיר' : 'מצב כהה'} onClick={toggleDarkMode}>
          {darkMode ? (
            <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="5" /><path strokeLinecap="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          ) : (
            <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
          )}
        </HeaderBtn>

        {/* Install / Add to Home Screen */}
        {showInstallBtn && (
          <HeaderBtn ariaLabel="התקן אפליקציה" onClick={() => { if (canInstall) { install() } else { setShowInstall(true) } }}>
            <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.5a6.5 6.5 0 100-13 6.5 6.5 0 000 13zM12 8v4m0 0l-2-2m2 2l2-2M8 21h8" />
            </svg>
          </HeaderBtn>
        )}
      </div>

      {/* Install instructions sheet */}
      {showInstall && (
        <InstallSheet
          canInstall={canInstall}
          onInstall={() => { install(); setShowInstall(false) }}
          onClose={() => {
            localStorage.setItem('pwaInstallDismissed', '1')
            setShowInstall(false)
          }}
        />
      )}
    </>
  )
}

const HeaderBtn: React.FC<{ onClick: () => void; disabled?: boolean; ariaLabel?: string; children: React.ReactNode }> = ({ onClick, disabled, ariaLabel, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    style={{
      width: 38, height: 38, borderRadius: 10, border: 'none',
      background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: disabled ? 'not-allowed' : 'pointer', color: 'var(--color-text)',
      opacity: disabled ? 0.3 : 1, flexShrink: 0,
      transition: `opacity 150ms ease, transform 120ms ${EASE}`,
      WebkitTapHighlightColor: 'transparent',
    }}
    onTouchStart={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.85)' }}
    onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
  >
    {children}
  </button>
)

const InstallSheet: React.FC<{ canInstall: boolean; onInstall: () => void; onClose: () => void }> = ({ canInstall, onInstall, onClose }) => (
  <>
    <div
      className="mobile-only"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
    />
    <div
      className="mobile-only"
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 710,
        background: 'var(--color-surface)',
        borderRadius: '24px 24px 0 0',
        padding: '20px 24px 32px',
        paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))',
        animation: `sheetIn 0.3s ${EASE} both`,
        boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
      }}
    >
      <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-border)', margin: '0 auto 20px' }} />

      {/* Icon */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="34" height="34" fill="none" stroke="white" strokeWidth="1.6" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>
          הוסף למסך הבית
        </div>
        {canInstall ? (
          <div style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            התקן את האפליקציה לגישה מהירה וגם ללא אינטרנט
          </div>
        ) : isIOS ? (
          <div style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            ב-Safari, לחץ על{' '}
            <svg width="15" height="15" fill="none" stroke="var(--color-accent)" strokeWidth="2" viewBox="0 0 24 24" style={{ display: 'inline', verticalAlign: 'middle', margin: '0 2px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/>
            </svg>
            {' '}ואז על{' '}
            <strong style={{ color: 'var(--color-text)' }}>"הוסף למסך הבית"</strong>
            {' '}כדי להתקין
          </div>
        ) : (
          <div style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            פתח ב-Chrome, לחץ על התפריט (⋮) ואז "הוסף למסך הבית"
          </div>
        )}
      </div>

      {canInstall && (
        <button
          onClick={onInstall}
          style={{
            width: '100%', padding: '15px', borderRadius: 14, border: 'none', cursor: 'pointer',
            background: '#2563eb', color: 'white', fontSize: 16, fontWeight: 700,
            fontFamily: 'inherit', marginBottom: 12,
            WebkitTapHighlightColor: 'transparent',
            transition: `transform 120ms ${EASE}`,
          }}
          onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)' }}
          onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
        >
          התקן את האפליקציה
        </button>
      )}

      <button
        onClick={onClose}
        style={{
          width: '100%', padding: '13px', borderRadius: 14, border: '1px solid var(--color-border)',
          background: 'var(--color-surface-2)', color: 'var(--color-text-muted)',
          fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {canInstall ? 'אחר כך' : 'סגור'}
      </button>
    </div>
  </>
)
