import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePDFStore, useAnnotationsStore, useUIStore } from '../../store'
import { embedAnnotationsIntoPdf, downloadBlob } from '../../utils/pdfExport'

export const TopToolbar: React.FC = () => {
  const { pdfDoc, pdfBytes, fileName, zoom, setZoom, currentPage, pageCount, setCurrentPage,
          viewMode, setViewMode, isSaving, setIsSaving, hasUnsavedChanges, pageInfos, pageOrder } = usePDFStore()
  const { annotations, formFields, undo, redo, past, future } = useAnnotationsStore()
  const { darkMode, toggleDarkMode, addToast, isFullscreen, setFullscreen, setSettingsOpen, searchOpen, setSearchOpen } = useUIStore()
  const navigate = useNavigate()
  const [pageInput, setPageInput] = useState('')
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [zoomInput, setZoomInput] = useState('')

  const handleExport = async () => {
    if (!pdfBytes) return
    setShowExportMenu(false)
    setIsSaving(true)
    try {
      const { watermark, pageNumbers } = usePDFStore.getState()
      const result = await embedAnnotationsIntoPdf(pdfBytes, annotations, formFields, pageInfos, pageOrder, { watermark, pageNumbers })
      downloadBlob(result, fileName.replace('.pdf', '') + '-edited.pdf')
      addToast('נשמר', 'success')
    } catch (e) { console.error(e); addToast('שגיאה בייצוא', 'error') }
    finally { setIsSaving(false) }
  }

  const handlePrint = () => window.print()

  const handleZoomSubmit = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const v = parseFloat(zoomInput)
      if (!isNaN(v)) setZoom(v / 100)
      setZoomInput('')
    }
  }

  const handlePageSubmit = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const v = parseInt(pageInput)
      if (!isNaN(v)) setCurrentPage(v - 1)
      setPageInput('')
    }
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setFullscreen(true)
    } else {
      document.exitFullscreen()
      setFullscreen(false)
    }
  }

  return (
    <div
      className="no-print desktop-only"
      style={{
        background: 'var(--color-primary)',
        height: 52,
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 4,
        flexShrink: 0,
        zIndex: 200,
        color: 'var(--color-text)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {/* Home button */}
      <TopBtn title="דף ראשי" onClick={() => navigate('/')}>
        <HomeIcon />
      </TopBtn>

      <div className="toolbar-sep" style={{ background: 'var(--color-border)' }} />

      {/* File actions */}
      {pdfDoc && (
        <>
          <TopBtn title="יצוא כ..." onClick={handleExport}>
            <ExportIcon />
          </TopBtn>
          <TopBtn title="הדפס" onClick={handlePrint}>
            <PrintIcon />
          </TopBtn>
        </>
      )}

      <div className="toolbar-sep" style={{ background: 'var(--color-border)' }} />

      {/* Undo/Redo */}
      {pdfDoc && (
        <>
          <TopBtn title="בטל (Ctrl+Z)" onClick={() => useAnnotationsStore.getState().undo()} disabled={!past.length}>
            <UndoIcon />
          </TopBtn>
          <TopBtn title="חזור (Ctrl+Y)" onClick={() => useAnnotationsStore.getState().redo()} disabled={!future.length}>
            <RedoIcon />
          </TopBtn>
          <div className="toolbar-sep" style={{ background: 'var(--color-border)' }} />
        </>
      )}

      {/* Zoom controls */}
      {pdfDoc && (
        <>
          <TopBtn title="הקטן" onClick={() => setZoom(Math.max(0.1, zoom - 0.1))}>
            <ZoomOutIcon />
          </TopBtn>
          <select
            value=""
            onChange={e => {
              const v = e.target.value
              if (v === 'fit-width') {
                const container = document.querySelector('.flex-1.overflow-auto') as HTMLElement
                if (container) {
                  const w = container.clientWidth - 80
                  const page = usePDFStore.getState().pageInfos[0]
                  if (page?.width > 0) setZoom(w / page.width)
                }
              } else if (v === 'fit-page') {
                const container = document.querySelector('.flex-1.overflow-auto') as HTMLElement
                if (container) {
                  const h = container.clientHeight - 64
                  const page = usePDFStore.getState().pageInfos[0]
                  if (page?.height > 0) setZoom(h / page.height)
                }
              } else {
                setZoom(parseFloat(v))
              }
            }}
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              borderRadius: 6,
              padding: '4px 6px',
              fontSize: 12,
              width: 72,
              direction: 'ltr',
              cursor: 'pointer',
              outline: 'none',
              appearance: 'none',
              textAlign: 'center',
            }}
          >
            <option value="" disabled style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}>{Math.round(zoom * 100)}%</option>
            <option value="fit-width" style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}>התאם רוחב</option>
            <option value="fit-page" style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}>התאם דף</option>
            {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map(v => (
              <option key={v} value={v} style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}>{Math.round(v * 100)}%</option>
            ))}
          </select>
          <TopBtn title="הגדל" onClick={() => setZoom(Math.min(4, zoom + 0.1))}>
            <ZoomInIcon />
          </TopBtn>
          <div className="toolbar-sep" style={{ background: 'var(--color-border)' }} />
        </>
      )}

      {/* Page navigation */}
      {pdfDoc && pageCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <TopBtn title="הקודם" onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 0}>
            <ChevronRight />
          </TopBtn>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-muted)', fontSize: 13 }}>
            <input
              className="input"
              style={{ width: 44, textAlign: 'center', fontSize: 12, padding: '4px 6px', direction: 'ltr',
                       background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                       color: 'var(--color-text)', borderRadius: 6 }}
              value={pageInput || String(currentPage + 1)}
              onChange={e => setPageInput(e.target.value)}
              onFocus={() => setPageInput(String(currentPage + 1))}
              onBlur={() => setPageInput('')}
              onKeyDown={handlePageSubmit}
            />
            <span>/ {pageCount}</span>
          </div>
          <TopBtn title="הבא" onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage >= pageCount - 1}>
            <ChevronLeft />
          </TopBtn>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* View mode (desktop) */}
      {pdfDoc && (
        <div style={{ display: 'flex', gap: 2 }} className="desktop-only">
          {(['continuous', 'two-page'] as const).map(mode => (
            <TopBtn
              key={mode}
              title={mode === 'continuous' ? 'גלילה רציפה' : 'שני דפים'}
              onClick={() => setViewMode(mode)}
              active={viewMode === mode}
            >
              {mode === 'continuous' ? <PageScrollIcon /> : <PageTwoIcon />}
            </TopBtn>
          ))}
          <div className="toolbar-sep" style={{ background: 'var(--color-border)' }} />
        </div>
      )}

      {/* Right actions */}
      {pdfDoc && (
        <TopBtn title="חיפוש במסמך (Ctrl+F)" onClick={() => setSearchOpen(!searchOpen)} active={searchOpen}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
          </svg>
        </TopBtn>
      )}
      <TopBtn title={darkMode ? 'מצב בהיר' : 'מצב כהה'} onClick={toggleDarkMode}>
        {darkMode ? <SunIcon /> : <MoonIcon />}
      </TopBtn>
      <TopBtn title={isFullscreen ? 'יציאה ממסך מלא' : 'מסך מלא'} onClick={toggleFullscreen}>
        {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
      </TopBtn>
      <TopBtn title="הגדרות" onClick={() => setSettingsOpen(true)}>
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      </TopBtn>

      {/* Unsaved indicator */}
      {hasUnsavedChanges && (
        <div style={{ width: 8, height: 8, background: '#f59e0b', borderRadius: '50%', flexShrink: 0 }} title="יש שינויים שלא נשמרו" />
      )}
    </div>
  )
}

// Helper button
const TopBtn: React.FC<{ title?: string; onClick?: () => void; disabled?: boolean; active?: boolean; children: React.ReactNode }> =
  ({ title, onClick, disabled, active, children }) => (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        minWidth: 32,
        minHeight: 32,
        padding: '5px 7px',
        border: 'none',
        borderRadius: 7,
        cursor: disabled ? 'not-allowed' : 'pointer',
        outline: 'none',
        fontFamily: 'inherit',
        fontSize: 13,
        color: active ? 'var(--color-ink-black)' : 'var(--color-graphite)',
        background: active ? 'var(--color-mint)' : 'transparent',
        opacity: disabled ? 0.4 : 1,
        transition: 'background 140ms ease-out, color 140ms ease-out, transform 150ms cubic-bezier(0.23,1,0.32,1)',
      }}
      onMouseEnter={e => {
        if (!disabled && !active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-mist)'
        if (!disabled && !active) (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-ink-black)'
      }}
      onMouseLeave={e => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
        if (!active) (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-graphite)'
      }}
      onMouseDown={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.9)' }}
      onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
    >
      {children}
    </button>
  )

// Icons
const HomeIcon = () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
const ExportIcon = () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
const PrintIcon = () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
const UndoIcon = () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6M3 10l6-6"/></svg>
const RedoIcon = () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2M21 10l-6 6M21 10l-6-6"/></svg>
const ZoomInIcon = () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" strokeWidth={2}/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 8v6M8 11h6"/></svg>
const ZoomOutIcon = () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" strokeWidth={2}/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M8 11h6"/></svg>
const FitWidthIcon = () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16M4 12l3-3M4 12l3 3M20 12l-3-3M20 12l-3 3"/></svg>
const ChevronRight = () => <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
const ChevronLeft = () => <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
const SunIcon = () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" strokeWidth={2}/><path strokeLinecap="round" strokeWidth={2} d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
const MoonIcon = () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
const FullscreenIcon = () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5M20 8V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5M20 16v4m0 0h-4m4 0l-5-5"/></svg>
const ExitFullscreenIcon = () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4M9 9H4M9 9L4 4M15 9V4m0 5h5m0 0l-5-5M9 15v5m0-5H4m5 0l-5 5M15 15h5m-5 0v5m0-5l5 5"/></svg>
const PageSingleIcon = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="4" y="1" width="8" height="14" rx="1" opacity="0.8"/></svg>
const PageScrollIcon = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="4" y="1" width="8" height="5" rx="1" opacity="0.8"/><rect x="4" y="7" width="8" height="5" rx="1" opacity="0.5"/></svg>
const PageTwoIcon = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="6" height="12" rx="1" opacity="0.8"/><rect x="9" y="2" width="6" height="12" rx="1" opacity="0.5"/></svg>
