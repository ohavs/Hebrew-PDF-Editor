import React, { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { usePDFStore, useAnnotationsStore, useUIStore } from '../../store'
import { usePDF } from '../../hooks/usePDF'
import { embedAnnotationsIntoPdf, downloadBlob } from '../../utils/pdfExport'
import i18n from '../../i18n'

export const TopToolbar: React.FC = () => {
  const { t } = useTranslation()
  const { pdfDoc, pdfBytes, fileName, zoom, setZoom, currentPage, pageCount, setCurrentPage,
          viewMode, setViewMode, isSaving, setIsSaving, hasUnsavedChanges, pageInfos, pageOrder } = usePDFStore()
  const { annotations, formFields, undo, redo, past, future } = useAnnotationsStore()
  const { darkMode, toggleDarkMode, language, setLanguage, addToast, isFullscreen, setFullscreen, sideToolbarOpen, toggleSideToolbar } = useUIStore()
  const { loadPDF } = usePDF()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pageInput, setPageInput] = useState('')
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [zoomInput, setZoomInput] = useState('')

  const handleOpen = () => fileInputRef.current?.click()

  const handleSave = async () => {
    if (!pdfBytes || !pdfDoc) return
    setIsSaving(true)
    try {
      const result = await embedAnnotationsIntoPdf(pdfBytes, annotations, formFields, pageInfos, pageOrder)
      downloadBlob(result, fileName || 'document-edited.pdf')
      addToast(t('file.saved'), 'success')
      usePDFStore.getState().setHasUnsavedChanges(false)
    } catch { addToast('שגיאה בשמירה', 'error') }
    finally { setIsSaving(false) }
  }

  const handleExport = async (format: 'pdf' | 'flattened' | 'pdfa') => {
    if (!pdfBytes) return
    setShowExportMenu(false)
    setIsSaving(true)
    try {
      const result = await embedAnnotationsIntoPdf(pdfBytes, annotations, formFields, pageInfos, pageOrder, format === 'flattened')
      const suffix = format === 'flattened' ? '-flat' : format === 'pdfa' ? '-pdfa' : '-edited'
      downloadBlob(result, fileName.replace('.pdf', '') + suffix + '.pdf')
      addToast(t('file.saved'), 'success')
    } catch { addToast('שגיאה בייצוא', 'error') }
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

  const toggleLang = () => {
    const next = language === 'he' ? 'en' : 'he'
    setLanguage(next)
    i18n.changeLanguage(next)
    document.documentElement.lang = next
    document.documentElement.dir = next === 'he' ? 'rtl' : 'ltr'
  }

  return (
    <div
      className="no-print"
      style={{
        background: 'var(--color-primary)',
        height: 52,
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 4,
        flexShrink: 0,
        zIndex: 200,
        color: 'white'
      }}
    >
      {/* Home button */}
      <TopBtn title="דף ראשי" onClick={() => navigate('/')}>
        <HomeIcon />
      </TopBtn>

      <div className="toolbar-sep" style={{ background: 'rgba(255,255,255,0.15)' }} />

      {/* Sidebar toggle */}
      <TopBtn title={sideToolbarOpen ? 'הסתר סרגל כלים' : 'הצג סרגל כלים'} onClick={toggleSideToolbar} active={sideToolbarOpen}>
        <SidebarIcon />
      </TopBtn>

      <div className="toolbar-sep" style={{ background: 'rgba(255,255,255,0.15)' }} />

      {/* File actions */}
      <input ref={fileInputRef} type="file" accept=".pdf" capture="environment" style={{ display: 'none' }}
        onChange={e => { if (e.target.files?.[0]) loadPDF(e.target.files[0]) }} />

      <TopBtn title={t('toolbar.open')} onClick={handleOpen}>
        <FolderIcon />
      </TopBtn>
      {pdfDoc && (
        <>
          <TopBtn title={t('toolbar.save')} onClick={handleSave} disabled={isSaving || !pdfBytes}>
            <SaveIcon />
          </TopBtn>
          <div style={{ position: 'relative' }}>
            <TopBtn title={t('file.exportAs')} onClick={() => setShowExportMenu(!showExportMenu)}>
              <ExportIcon />
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <path d="M5 7L1 3h8z" />
              </svg>
            </TopBtn>
            {showExportMenu && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, zIndex: 999,
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                borderRadius: 8, padding: 4, minWidth: 220, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                marginTop: 4
              }}>
                {[
                  { key: 'pdf', label: t('file.exportPDF') },
                  { key: 'flattened', label: t('file.exportFlattened') },
                  { key: 'pdfa', label: t('file.exportPDFA') }
                ].map(opt => (
                  <button key={opt.key} className="btn btn-ghost"
                    style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--color-text)', borderRadius: 6 }}
                    onClick={() => handleExport(opt.key as any)}
                  >{opt.label}</button>
                ))}
              </div>
            )}
          </div>
          <TopBtn title={t('toolbar.print')} onClick={handlePrint}>
            <PrintIcon />
          </TopBtn>
        </>
      )}

      <div className="toolbar-sep" style={{ background: 'rgba(255,255,255,0.15)' }} />

      {/* Undo/Redo */}
      {pdfDoc && (
        <>
          <TopBtn title={`${t('toolbar.undo')} (Ctrl+Z)`} onClick={() => useAnnotationsStore.getState().undo()} disabled={!past.length}>
            <UndoIcon />
          </TopBtn>
          <TopBtn title={`${t('toolbar.redo')} (Ctrl+Y)`} onClick={() => useAnnotationsStore.getState().redo()} disabled={!future.length}>
            <RedoIcon />
          </TopBtn>
          <div className="toolbar-sep" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </>
      )}

      {/* Zoom controls */}
      {pdfDoc && (
        <>
          <TopBtn title={t('toolbar.zoomOut')} onClick={() => setZoom(zoom - 0.1)}>
            <ZoomOutIcon />
          </TopBtn>
          <input
            className="input"
            style={{ width: 60, textAlign: 'center', fontSize: 12, padding: '4px 6px', direction: 'ltr',
                     background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                     color: 'white', borderRadius: 6 }}
            value={zoomInput || `${Math.round(zoom * 100)}%`}
            onChange={e => setZoomInput(e.target.value)}
            onFocus={() => setZoomInput(String(Math.round(zoom * 100)))}
            onBlur={() => setZoomInput('')}
            onKeyDown={handleZoomSubmit}
          />
          <TopBtn title={t('toolbar.zoomIn')} onClick={() => setZoom(zoom + 0.1)}>
            <ZoomInIcon />
          </TopBtn>
          <TopBtn title={t('toolbar.fitWidth')} onClick={() => {
            const container = document.querySelector('.flex-1.overflow-auto') as HTMLElement
            if (container && pdfDoc) {
              const w = container.clientWidth - 80
              const page = usePDFStore.getState().pageInfos[0]
              if (page?.width > 0) setZoom(w / page.width)
            }
          }}>
            <FitWidthIcon />
          </TopBtn>
          <div className="toolbar-sep" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </>
      )}

      {/* Page navigation */}
      {pdfDoc && pageCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <TopBtn title="הקודם" onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 0}>
            <ChevronRight />
          </TopBtn>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
            <input
              className="input"
              style={{ width: 44, textAlign: 'center', fontSize: 12, padding: '4px 6px', direction: 'ltr',
                       background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                       color: 'white', borderRadius: 6 }}
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
          {(['single', 'continuous', 'two-page'] as const).map(mode => (
            <TopBtn
              key={mode}
              title={t(`viewer.${mode === 'single' ? 'singlePage' : mode === 'continuous' ? 'continuous' : 'twoPage'}`)}
              onClick={() => setViewMode(mode)}
              active={viewMode === mode}
            >
              {mode === 'single' ? <PageSingleIcon /> : mode === 'continuous' ? <PageScrollIcon /> : <PageTwoIcon />}
            </TopBtn>
          ))}
          <div className="toolbar-sep" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>
      )}

      {/* Right actions */}
      <TopBtn title={t(darkMode ? 'toolbar.lightMode' : 'toolbar.darkMode')} onClick={toggleDarkMode}>
        {darkMode ? <SunIcon /> : <MoonIcon />}
      </TopBtn>
      <TopBtn title={t('toolbar.language')} onClick={toggleLang}>
        <span style={{ fontSize: 12, fontWeight: 700 }}>{language === 'he' ? 'EN' : 'עב'}</span>
      </TopBtn>
      <TopBtn title={t(isFullscreen ? 'toolbar.exitFullscreen' : 'toolbar.fullscreen')} onClick={toggleFullscreen}>
        {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
      </TopBtn>

      {/* Unsaved indicator */}
      {hasUnsavedChanges && (
        <div style={{ width: 8, height: 8, background: '#f59e0b', borderRadius: '50%', flexShrink: 0 }} title={t('file.unsavedChanges')} />
      )}
    </div>
  )
}

// Helper button
const TopBtn: React.FC<{ title?: string; onClick?: () => void; disabled?: boolean; active?: boolean; children: React.ReactNode }> =
  ({ title, onClick, disabled, active, children }) => (
    <button
      className="btn-icon"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        color: active ? '#60a5fa' : 'rgba(255,255,255,0.75)',
        background: active ? 'rgba(96,165,250,0.15)' : 'transparent',
        minWidth: 32, minHeight: 32, padding: 6
      }}
    >
      {children}
    </button>
  )

// Icons
const HomeIcon = () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
const SidebarIcon = () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2}/><path strokeWidth={2} d="M9 3v18" strokeLinecap="round"/></svg>
const FolderIcon = () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>
const SaveIcon = () => <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
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
