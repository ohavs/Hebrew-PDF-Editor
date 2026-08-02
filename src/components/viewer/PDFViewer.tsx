import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { usePDFStore, useUIStore, useAnnotationsStore } from '../../store'
import { PDFPage } from './PDFPage'
import { useDropzone } from 'react-dropzone'
import { usePDF } from '../../hooks/usePDF'
import { useSessions } from '../../hooks/useSessions'
import { listSessions, type SessionMeta } from '../../utils/sessions'
import { SPREAD_GAP } from '../../utils/fitZoom'

export const PDFViewer: React.FC = () => {
  const { pdfDoc, pageCount, currentPage, setCurrentPage, zoom, setZoom, viewMode, pageOrder, isLoading, loadingProgress } = usePDFStore()
  const { activeTool, showDropOverlay, setShowDropOverlay } = useUIStore()
  const { loadPDF } = usePDF()
  const containerRef = useRef<HTMLDivElement>(null)
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set([0]))

  // On mobile, fit zoom to screen width from the document's TRUE natural page
  // width (pdf.js viewport at scale 1 — not the placeholder in pageInfos).
  const fitToWidth = async () => {
    if (!pdfDoc || window.innerWidth >= 768) return
    try {
      const firstDisplayed = (usePDFStore.getState().pageOrder[0] ?? 0) + 1
      const page = await pdfDoc.getPage(firstDisplayed)
      const rotation = ((page.rotate || 0) % 360 + 360) % 360
      const naturalW = page.getViewport({ scale: 1, rotation }).width
      const cw = containerRef.current?.clientWidth || window.innerWidth
      // A spread is two pages plus the gap between them
      const perSpread = usePDFStore.getState().viewMode === 'two-page' ? 2 : 1
      const available = cw - 16 - (perSpread - 1) * SPREAD_GAP
      const fit = Math.max(0.25, Math.min(available / (naturalW * perSpread), 1.5))
      fitZoomRef.current = fit
      setZoom(fit)
    } catch { /* keep current zoom */ }
  }

  // Refit on load and whenever the spread changes — switching to two-page
  // otherwise left the second page hanging off the side of the screen
  useEffect(() => { fitToWidth() }, [pdfDoc, viewMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fit when the device rotates (large width change, not keyboard show/hide)
  useEffect(() => {
    let lastW = window.innerWidth
    const onResize = () => {
      const w = window.innerWidth
      if (Math.abs(w - lastW) > 150) { lastW = w; fitToWidth() }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [pdfDoc]) // eslint-disable-line react-hooks/exhaustive-deps
  // Drag-and-drop to open PDF (noClick: true — EmptyState handles clicks itself)
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    noClick: true,
    noKeyboard: true,
    onDrop: (files) => {
      if (files[0]) loadPDF(files[0])
    },
    onDragEnter: () => setShowDropOverlay(true),
    onDragLeave: () => setShowDropOverlay(false),
    onDropAccepted: () => setShowDropOverlay(false),
    onDropRejected: () => setShowDropOverlay(false),
  })

  // ── Anchored zoom: keep the point under the fingers/cursor stationary ────
  const pendingAnchor = useRef<{ ax: number; ay: number; ratio: number; scrollTop: number; scrollLeft: number } | null>(null)

  const applyZoom = useCallback((newZoom: number, anchorClientX?: number, anchorClientY?: number) => {
    const el = containerRef.current
    const old = usePDFStore.getState().zoom
    const clamped = Math.max(0.25, Math.min(3, Math.round(newZoom * 100) / 100))
    if (!el || clamped === old) return
    const rect = el.getBoundingClientRect()
    const ax = (anchorClientX ?? rect.left + rect.width / 2) - rect.left
    const ay = (anchorClientY ?? rect.top + rect.height / 2) - rect.top
    pendingAnchor.current = { ax, ay, ratio: clamped / old, scrollTop: el.scrollTop, scrollLeft: el.scrollLeft }
    setZoom(clamped)
  }, [setZoom])

  useLayoutEffect(() => {
    const p = pendingAnchor.current
    const el = containerRef.current
    if (!p || !el) return
    pendingAnchor.current = null
    el.scrollTop = (p.scrollTop + p.ay) * p.ratio - p.ay
    el.scrollLeft = (p.scrollLeft + p.ax) * p.ratio - p.ax
  }, [zoom])

  // ── Stepped pinch-to-zoom + double-tap ────────────────────────────────────
  // Pinch snaps to 10% increments (same steps as the +/- buttons) so the
  // gesture feels controlled instead of jittery. Double-tap toggles between
  // fit-width and 2× around the tap point (select mode only).
  const fitZoomRef = useRef(1)
  const lastTapRef = useRef<{ t: number; x: number; y: number } | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el || !pdfDoc) return

    let pinch: { startDist: number; startZoom: number; lastStepped: number } | null = null

    const midpoint = (e: TouchEvent) => ({
      x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
      y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
    })

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        )
        const z = usePDFStore.getState().zoom
        pinch = { startDist: dist, startZoom: z, lastStepped: z }
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return
      e.preventDefault()
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      const raw = pinch.startZoom * (dist / pinch.startDist)
      // Snap to 10% steps — controlled, never "goes crazy"
      const stepped = Math.max(0.25, Math.min(3, Math.round(raw * 10) / 10))
      if (stepped !== pinch.lastStepped) {
        pinch.lastStepped = stepped
        const m = midpoint(e)
        applyZoom(stepped, m.x, m.y)
      }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (pinch) { if (e.touches.length < 2) pinch = null; return }
      // Double-tap to zoom (select mode only — tools use taps for editing)
      if (useUIStore.getState().activeTool !== 'select') return
      if (e.changedTouches.length !== 1 || e.touches.length !== 0) return
      const t = e.changedTouches[0]
      const now = Date.now()
      const last = lastTapRef.current
      if (last && now - last.t < 300 && Math.hypot(t.clientX - last.x, t.clientY - last.y) < 30) {
        lastTapRef.current = null
        const z = usePDFStore.getState().zoom
        const target = Math.abs(z - fitZoomRef.current) < 0.05 ? Math.min(3, fitZoomRef.current * 2) : fitZoomRef.current
        applyZoom(target, t.clientX, t.clientY)
      } else {
        lastTapRef.current = { t: now, x: t.clientX, y: t.clientY }
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [pdfDoc, applyZoom])

  // ── Lazy rendering + current-page sync from scroll ────────────────────────
  const scrollSetPage = useRef<number | null>(null)
  const ratiosRef = useRef<Map<number, number>>(new Map())
  // Pages currently intersecting the viewport. The rendered set is derived
  // from this each time, so it SHRINKS as well as grows — an ever-growing set
  // kept every visited page's full-resolution canvas alive (~12MB per A4 page
  // at mobile DPR), which crashed the tab on long documents.
  const intersectingRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    if (!containerRef.current || !pdfDoc) return
    const container = containerRef.current
    intersectingRef.current.clear()
    ratiosRef.current.clear()

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const match = entry.target.id.match(/^page-(\d+)$/)
        if (!match) return
        const idx = parseInt(match[1])
        ratiosRef.current.set(idx, entry.isIntersecting ? entry.intersectionRatio : 0)
        if (entry.isIntersecting) intersectingRef.current.add(idx)
        else intersectingRef.current.delete(idx)
      })

      // Render what's on screen plus one page of buffer on each side
      const next = new Set<number>()
      intersectingRef.current.forEach(idx => {
        next.add(idx)
        if (idx > 0) next.add(idx - 1)
        if (idx < pageCount - 1) next.add(idx + 1)
      })
      // Never end up with nothing rendered (e.g. mid-layout with no entries yet)
      if (next.size === 0) next.add(usePDFStore.getState().currentPage)

      setVisiblePages(prev => {
        if (prev.size === next.size && [...next].every(i => prev.has(i))) return prev
        return next
      })

      // The most-visible page becomes the current page (keeps the header
      // indicator and pages sheet in sync while scrolling)
      let best = -1, bestRatio = 0
      ratiosRef.current.forEach((ratio, idx) => {
        if (ratio > bestRatio) { bestRatio = ratio; best = idx }
      })
      if (best >= 0 && bestRatio > 0 && best !== usePDFStore.getState().currentPage) {
        scrollSetPage.current = best
        setCurrentPage(best)
      }
    }, { root: container, threshold: [0.01, 0.25, 0.5, 0.75, 1] })

    const timer = setTimeout(() => {
      document.querySelectorAll('[id^="page-"]').forEach(el => observer.observe(el))
    }, 100)

    return () => { observer.disconnect(); clearTimeout(timer) }
  }, [pdfDoc, pageCount, viewMode, pageOrder])

  // Scroll to current page on explicit navigation (not scroll-derived sync)
  useEffect(() => {
    if (scrollSetPage.current === currentPage) { scrollSetPage.current = null; return }
    const el = document.getElementById(`page-${currentPage}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [currentPage])

  // Ctrl+wheel zoom, anchored at cursor
  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY < 0 ? 0.1 : -0.1
      const z = usePDFStore.getState().zoom
      applyZoom(Math.round((z + delta) * 10) / 10, e.clientX, e.clientY)
    }
  }, [applyZoom])

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
        className="pdf-page-group"
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 16,
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
      className="flex-1 overflow-auto relative pdf-scroll-container"
      style={{
        background: 'var(--color-surface-2)',
        backgroundImage: 'radial-gradient(var(--color-border) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        position: 'relative',
        // Browser handles panning; two-finger pinch reaches our JS handler
        touchAction: 'pan-x pan-y',
      }}
      // Click on empty space (canvas / background) deselects. In select mode
      // the annotation layer is pointer-transparent, so this is the only
      // element that hears the click; overlays stop propagation themselves.
      onClick={() => {
        if (useUIStore.getState().activeTool === 'select') {
          useAnnotationsStore.getState().selectAnnotation(null)
        }
      }}
    >
      {!pdfDoc && <input {...getInputProps()} />}

      {/* Drop overlay */}
      {(isDragActive || showDropOverlay) && (
        <div className="drop-overlay">
          <div style={{ textAlign: 'center', color: 'var(--color-accent)', pointerEvents: 'none' }}>
            <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ margin: '0 auto 16px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div style={{ fontSize: 20, fontWeight: 600 }}>גרור קובץ PDF לכאן</div>
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
          <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>טוען... {loadingProgress}%</div>
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
        className="pdf-pages-container"
        style={{
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
  const { resumeSession } = useSessions()
  const [urlInput, setUrlInput] = useState('')
  const [dragging, setDragging] = useState(false)
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { listSessions().then(s => setSessions(s.slice(0, 4))) }, [])

  const handleUrlLoad = async () => {
    if (!urlInput.trim()) return
    await loadPDF(urlInput.trim())
  }

  return (
    <div style={{
      textAlign: 'center',
      padding: '40px 24px',
      maxWidth: 420,
      animation: 'fadeUpEmptyState 0.35s cubic-bezier(0.23,1,0.32,1) both',
    }}>
      <style>{`
        @keyframes fadeUpEmptyState {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Drop zone card */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) loadPDF(f) }}
        style={{
          border: `2px dashed ${dragging ? 'var(--color-accent)' : 'var(--color-border)'}`,
          borderRadius: 20,
          padding: '40px 32px',
          cursor: 'pointer',
          background: dragging ? 'rgba(37,99,235,0.04)' : 'var(--color-surface)',
          transition: 'border-color 200ms ease-out, background 200ms ease-out, transform 160ms cubic-bezier(0.23,1,0.32,1)',
          marginBottom: 16,
          transform: dragging ? 'scale(1.02)' : 'scale(1)',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-accent)' }}
        onMouseLeave={e => { if (!dragging) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border)' }}
      >
        {/* PDF illustration */}
        <div style={{ marginBottom: 20 }}>
          <svg width="64" height="64" viewBox="0 0 48 48" fill="none" style={{ margin: '0 auto', display: 'block' }}>
            <rect x="6" y="4" width="26" height="36" rx="4" fill="rgba(37,99,235,0.08)" stroke="var(--color-accent)" strokeWidth="1.5"/>
            <path d="M32 4l10 10h-10V4z" fill="rgba(37,99,235,0.15)" stroke="var(--color-accent)" strokeWidth="1.5"/>
            <path d="M12 20h16M12 26h10" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="38" cy="36" r="9" fill="rgba(37,99,235,0.1)" stroke="var(--color-accent)" strokeWidth="1.5"/>
            <path d="M38 31v10M33 36h10" stroke="var(--color-accent)" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </div>

        <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--color-text)', marginBottom: 8 }}>
          גרור קובץ PDF לכאן
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          או לחץ לבחירת קובץ
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        style={{ display: 'none' }}
        onChange={e => { if (e.target.files?.[0]) loadPDF(e.target.files[0]) }}
      />

      {/* URL input */}
      <div style={{ display: 'flex', gap: 8, direction: 'ltr' }}>
        <input
          className="input"
          placeholder="הדבק כתובת URL של PDF"
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleUrlLoad()}
          dir="ltr"
          style={{ flex: 1, fontSize: 12 }}
        />
        <button className="btn btn-secondary" onClick={handleUrlLoad} style={{ flexShrink: 0, fontSize: 12 }}>
          טען מ-URL
        </button>
      </div>

      {/* Recent sessions — continue where you left off */}
      {sessions.length > 0 && (
        <div style={{ marginTop: 28, textAlign: 'start' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 10 }}>
            המשך מהיכן שהפסקת
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sessions.map(s => (
              <button
                key={s.id}
                onClick={() => resumeSession(s.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px',
                  borderRadius: 12, border: '1px solid var(--color-border)', cursor: 'pointer',
                  background: 'var(--color-surface)', fontFamily: 'inherit', textAlign: 'start',
                  transition: 'border-color 150ms ease-out, transform 150ms cubic-bezier(0.23,1,0.32,1)',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-ink-black)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)' }}
                onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)' }}
                onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
              >
                <span style={{
                  width: 38, height: 48, borderRadius: 6, flexShrink: 0, overflow: 'hidden',
                  background: 'var(--color-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {s.thumbnail
                    ? <img src={s.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                    : <span style={{ fontSize: 18 }}>📄</span>}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted)' }}>{s.pageCount} עמ׳</span>
                </span>
                <svg width="16" height="16" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
