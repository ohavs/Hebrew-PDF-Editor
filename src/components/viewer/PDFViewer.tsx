import React, { useEffect, useRef, useState, useCallback } from 'react'
import { usePDFStore, useUIStore } from '../../store'
import { PDFPage } from './PDFPage'
import { useDropzone } from 'react-dropzone'
import { usePDF } from '../../hooks/usePDF'
import { useTranslation } from 'react-i18next'

export const PDFViewer: React.FC = () => {
  const { pdfDoc, pageCount, currentPage, setCurrentPage, zoom, setZoom, viewMode, pageOrder, isLoading, loadingProgress } = usePDFStore()
  const { activeTool, showDropOverlay, setShowDropOverlay } = useUIStore()
  const { loadPDF } = usePDF()
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set([0]))
  const lastPinchRef = useRef<number>(0)

  // Drag-and-drop to open PDF
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    noClick: !!pdfDoc,
    noKeyboard: true,
    onDrop: (files) => {
      if (files[0]) loadPDF(files[0])
    },
    onDragEnter: () => setShowDropOverlay(true),
    onDragLeave: () => setShowDropOverlay(false),
    onDropAccepted: () => setShowDropOverlay(false),
    onDropRejected: () => setShowDropOverlay(false),
  })

  // Intersection observer for lazy rendering
  useEffect(() => {
    if (!containerRef.current || !pdfDoc) return
    const container = containerRef.current

    const observer = new IntersectionObserver((entries) => {
      setVisiblePages(prev => {
        const next = new Set(prev)
        entries.forEach(entry => {
          const id = entry.target.id
          const match = id.match(/^page-(\d+)$/)
          if (match) {
            const idx = parseInt(match[1])
            if (entry.isIntersecting) {
              next.add(idx)
              // Buffer pages ±1
              if (idx > 0) next.add(idx - 1)
              if (idx < pageCount - 1) next.add(idx + 1)
            }
          }
        })
        return next
      })
    }, { root: container, threshold: 0.01 })

    // Observe all page divs after a tick
    const timer = setTimeout(() => {
      document.querySelectorAll('[id^="page-"]').forEach(el => observer.observe(el))
    }, 100)

    return () => { observer.disconnect(); clearTimeout(timer) }
  }, [pdfDoc, pageCount])

  // Scroll to current page (single page mode)
  useEffect(() => {
    if (viewMode !== 'continuous') {
      const el = document.getElementById(`page-${currentPage}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [currentPage, viewMode])

  // Pinch-to-zoom
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      lastPinchRef.current = dist
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastPinchRef.current > 0) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      const delta = dist / lastPinchRef.current
      setZoom(zoom * delta)
      lastPinchRef.current = dist
      e.preventDefault()
    }
  }, [zoom, setZoom])

  // Scroll-to-zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY < 0 ? 0.1 : -0.1
      setZoom(usePDFStore.getState().zoom + delta)
    }
  }, [setZoom])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const renderPages = () => {
    if (!pdfDoc) return null
    const pages = viewMode === 'two-page'
      ? pageOrder.reduce<number[][]>((acc, idx, i) => {
          if (i % 2 === 0) acc.push([idx])
          else acc[acc.length - 1].push(idx)
          return acc
        }, [])
      : pageOrder.map(idx => [idx])

    return pages.map((group, gi) => (
      <div
        key={gi}
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 16,
          padding: viewMode === 'single' ? '0 24px' : '0 24px'
        }}
      >
        {group.map(pageIdx => (
          <PDFPage
            key={pageIdx}
            pageIndex={pageIdx}
            isVisible={visiblePages.has(pageIdx)}
            isCurrent={pageIdx === currentPage}
          />
        ))}
      </div>
    ))
  }

  return (
    <div
      {...(pdfDoc ? {} : getRootProps())}
      ref={containerRef}
      className="flex-1 overflow-auto relative"
      style={{ background: 'var(--color-surface-2)', position: 'relative' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      {!pdfDoc && <input {...getInputProps()} />}

      {/* Drop overlay */}
      {(isDragActive || showDropOverlay) && (
        <div className="drop-overlay">
          <div style={{ textAlign: 'center', color: 'var(--color-accent)', pointerEvents: 'none' }}>
            <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ margin: '0 auto 16px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{t('viewer.dropHere')}</div>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', background: 'var(--color-surface-2)',
          zIndex: 100
        }}>
          <div style={{ width: 200, height: 4, background: 'var(--color-border)', borderRadius: 2, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ width: `${loadingProgress}%`, height: '100%', background: 'var(--color-accent)', borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{t('viewer.loading')} {loadingProgress}%</div>
        </div>
      )}

      {/* Empty state */}
      {!pdfDoc && !isLoading && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <EmptyState />
        </div>
      )}

      {/* Pages */}
      <div
        style={{
          padding: '24px 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minHeight: '100%'
        }}
      >
        {renderPages()}
      </div>
    </div>
  )
}

const EmptyState: React.FC = () => {
  const { loadPDF } = usePDF()
  const { addToast } = useUIStore()
  const { t } = useTranslation()
  const [urlInput, setUrlInput] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUrlLoad = async () => {
    if (!urlInput.trim()) return
    await loadPDF(urlInput.trim())
  }

  return (
    <div style={{ textAlign: 'center', padding: 40, maxWidth: 480 }}>
      <div style={{ marginBottom: 24 }}>
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" style={{ margin: '0 auto' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: 'var(--color-text)' }}>
        {t('viewer.dropHere')}
      </h2>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 24 }}>
        {t('viewer.or')}
      </p>
      <button
        className="btn btn-primary"
        style={{ marginBottom: 16, fontSize: 15 }}
        onClick={() => fileInputRef.current?.click()}
      >
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        {t('toolbar.open')}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        capture="environment"
        style={{ display: 'none' }}
        onChange={e => { if (e.target.files?.[0]) loadPDF(e.target.files[0]) }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input
          className="input"
          placeholder={t('viewer.pasteUrl')}
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleUrlLoad()}
          dir="ltr"
        />
        <button className="btn btn-secondary" onClick={handleUrlLoad} style={{ flexShrink: 0 }}>
          {t('viewer.loadUrl')}
        </button>
      </div>
    </div>
  )
}
