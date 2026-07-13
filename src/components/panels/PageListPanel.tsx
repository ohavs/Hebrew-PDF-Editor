import React, { useRef, useState, useEffect, useCallback } from 'react'
import { usePDFStore, useUIStore } from '../../store'
import { usePDF } from '../../hooks/usePDF'
import { usePageOps } from '../../hooks/usePageOps'

const EASE = 'cubic-bezier(0.23,1,0.32,1)'
const ROW_H = 76 // fixed row height keeps the drag math trivial

/**
 * Vertical list of all pages: lazy thumbnail, page number, and per-row
 * rotate / duplicate / delete. Reordering via pointer-drag on the handle —
 * works with touch, mouse and pen. Shared by the organize tool (desktop
 * panel + mobile sheet) and the mobile pages sheet.
 */
export const PageListPanel: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  const { pdfDoc, currentPage, setCurrentPage, pageOrder, pageInfos, pageLabels, rotatePage } = usePDFStore()
  const { addToast } = useUIStore()
  const { deletePage, duplicatePage } = usePageOps()
  const [busy, setBusy] = useState(false)
  const [previewIdx, setPreviewIdx] = useState<number | null>(null)

  // Drag state
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragDy, setDragDy] = useState(0)
  const dragDyRef = useRef(0)
  const dragTarget = dragIdx === null ? null
    : Math.max(0, Math.min(pageOrder.length - 1, dragIdx + Math.round(dragDy / ROW_H)))

  const startDrag = useCallback((e: React.PointerEvent, idx: number) => {
    e.preventDefault()
    e.stopPropagation()
    const el = e.currentTarget as HTMLElement
    const pid = e.pointerId
    const startY = e.clientY
    try { el.setPointerCapture(pid) } catch { /* ignore */ }
    setDragIdx(idx)
    setDragDy(0)
    dragDyRef.current = 0

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return
      ev.preventDefault()
      dragDyRef.current = ev.clientY - startY
      setDragDy(dragDyRef.current)
    }
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      const count = usePDFStore.getState().pageOrder.length
      const target = Math.max(0, Math.min(count - 1, idx + Math.round(dragDyRef.current / ROW_H)))
      if (target !== idx) usePDFStore.getState().reorderPages(idx, target)
      setDragIdx(null)
      setDragDy(0)
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
  }, [])

  if (!pdfDoc) return null

  const wrap = (fn: () => Promise<unknown>) => async () => {
    if (busy) return
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, opacity: busy ? 0.6 : 1, pointerEvents: busy ? 'none' : 'auto' }}>
      {pageOrder.map((naturalIdx, i) => {
        const isCurrent = naturalIdx === currentPage
        const isDragging = dragIdx === i
        // Rows between the drag origin and target shift to make room
        let shift = 0
        if (dragIdx !== null && dragTarget !== null && !isDragging) {
          if (dragIdx < dragTarget && i > dragIdx && i <= dragTarget) shift = -ROW_H
          else if (dragIdx > dragTarget && i >= dragTarget && i < dragIdx) shift = ROW_H
        }
        return (
          <div
            key={naturalIdx}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              height: ROW_H - 6,
              padding: '0 8px',
              borderRadius: 14,
              background: isCurrent ? 'var(--color-mint)' : 'var(--color-surface-2)',
              outline: isDragging ? '2px solid var(--color-accent)' : 'none',
              transform: isDragging ? `translateY(${dragDy}px) scale(1.02)` : `translateY(${shift}px)`,
              transition: isDragging ? 'none' : `transform 180ms ${EASE}`,
              zIndex: isDragging ? 10 : 1,
              position: 'relative',
              boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.2)' : 'none',
            }}
            onClick={() => { setCurrentPage(naturalIdx); onNavigate?.() }}
          >
            {/* Drag handle */}
            <div
              onPointerDown={e => startDrag(e, i)}
              onClick={e => e.stopPropagation()}
              style={{
                width: 36, height: '100%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'grab', touchAction: 'none',
                color: 'var(--color-text-muted)',
              }}
              aria-label="גרור לשינוי סדר"
            >
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/>
                <circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/>
                <circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/>
              </svg>
            </div>

            {/* Thumbnail — tap to preview the page content */}
            <div
              onClick={e => { e.stopPropagation(); setPreviewIdx(naturalIdx) }}
              style={{ cursor: 'zoom-in' }}
              aria-label={`תצוגה מקדימה של עמוד ${i + 1}`}
            >
              <PageThumbLazy pdfDoc={pdfDoc} pageIndex={naturalIdx} rotation={pageInfos[naturalIdx]?.rotation || 0} />
            </div>

            {/* Label */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>עמוד {i + 1}</span>
                {pageLabels[naturalIdx] && (
                  <span style={{
                    fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                    background: 'rgba(37,99,235,0.12)', color: '#2563eb', whiteSpace: 'nowrap',
                  }}>
                    {pageLabels[naturalIdx]}
                  </span>
                )}
              </div>
              {naturalIdx !== i && (
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  הוזז · היה עמוד {naturalIdx + 1}
                </div>
              )}
              {(pageInfos[naturalIdx]?.rotation || 0) % 360 !== 0 && (
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                  ↻ {((pageInfos[naturalIdx]?.rotation || 0) % 360 + 360) % 360}°
                </div>
              )}
            </div>

            {/* Row actions */}
            <RowBtn label="סובב" onClick={e => { e.stopPropagation(); rotatePage(naturalIdx, 90); addToast(`עמוד ${i + 1} סובב`, 'success') }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M4 9a8 8 0 1 1-2 5"/>
              </svg>
            </RowBtn>
            <RowBtn label="שכפל" onClick={e => { e.stopPropagation(); wrap(() => duplicatePage(i))() }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
            </RowBtn>
            <RowBtn label="מחק" danger onClick={e => { e.stopPropagation(); wrap(() => deletePage(i))() }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </RowBtn>
          </div>
        )
      })}

      {previewIdx !== null && (
        <PagePreviewModal
          pdfDoc={pdfDoc}
          pageIndex={previewIdx}
          displayNum={Math.max(0, pageOrder.indexOf(previewIdx)) + 1}
          rotation={pageInfos[previewIdx]?.rotation || 0}
          onClose={() => setPreviewIdx(null)}
        />
      )}
    </div>
  )
}

/** Large page preview — opened by tapping a thumbnail in the list. */
const PagePreviewModal: React.FC<{
  pdfDoc: any; pageIndex: number; displayNum: number; rotation: number; onClose: () => void
}> = ({ pdfDoc, pageIndex, displayNum, rotation, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { renderThumbnail } = usePDF()

  useEffect(() => {
    if (!canvasRef.current) return
    const width = Math.min(window.innerWidth - 48, 620)
    renderThumbnail(pdfDoc, pageIndex, canvasRef.current, width, rotation)
  }, [pdfDoc, pageIndex, rotation, renderThumbnail])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 900,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 20, cursor: 'zoom-out',
      }}
    >
      <div style={{
        color: 'white', fontSize: 14, fontWeight: 700, marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        עמוד {displayNum}
        <button
          onClick={onClose}
          aria-label="סגור"
          style={{
            width: 32, height: 32, borderRadius: 9, border: 'none',
            background: 'rgba(255,255,255,0.15)', color: 'white', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 0, padding: 0,
          }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div style={{
        maxHeight: 'calc(100dvh - 120px)', overflow: 'auto',
        borderRadius: 8, boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        background: 'white',
      }}>
        <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%' }} />
      </div>
    </div>
  )
}

const RowBtn: React.FC<{ label: string; danger?: boolean; onClick: (e: React.MouseEvent) => void; children: React.ReactNode }> =
  ({ label, danger, onClick, children }) => (
    <button
      aria-label={label}
      onClick={onClick}
      style={{
        width: 40, height: 40, borderRadius: 10, border: 'none', flexShrink: 0,
        background: 'transparent',
        color: danger ? 'var(--color-danger)' : 'var(--color-text-muted)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        WebkitTapHighlightColor: 'transparent',
        transition: `transform 120ms ${EASE}`,
        minHeight: 0, padding: 0,
      }}
      onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.85)' }}
      onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
    >
      {children}
    </button>
  )

/** Thumbnail that renders only when scrolled into view, once. */
const PageThumbLazy: React.FC<{ pdfDoc: any; pageIndex: number; rotation: number }> = ({ pdfDoc, pageIndex, rotation }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { renderThumbnail } = usePDF()
  const renderedFor = useRef<string>('')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const key = `${pageIndex}-${rotation}`
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && renderedFor.current !== key) {
          renderedFor.current = key
          renderThumbnail(pdfDoc, pageIndex, canvas, 44, rotation)
        }
      })
    }, { rootMargin: '200px' })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [pdfDoc, pageIndex, rotation, renderThumbnail])

  return (
    <div style={{
      width: 46, height: 60, flexShrink: 0, borderRadius: 6, overflow: 'hidden',
      background: 'white', border: '1px solid var(--color-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }} />
    </div>
  )
}
