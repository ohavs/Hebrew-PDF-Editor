import React, { useRef, useState, useEffect, useCallback } from 'react'
import { usePDFStore, useUIStore } from '../../store'
import { usePDF } from '../../hooks/usePDF'
import { usePageOps } from '../../hooks/usePageOps'

const EASE = 'cubic-bezier(0.23,1,0.32,1)'
const THUMB_RES = 260 // render width — crisp when the card scales it

/**
 * Grid of large page cards: thumbnail big enough to recognise content at a
 * glance, drag-handle reordering (pointer events, works on touch), and
 * per-page rotate / duplicate / delete. Shared by the organize tool and the
 * mobile pages sheet; the grid reflows from 2 to 4 columns by container width.
 */
export const PageListPanel: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  const { pdfDoc, currentPage, setCurrentPage, pageOrder, pageInfos, pageLabels, rotatePage } = usePDFStore()
  const { addToast } = useUIStore()
  const { deletePage, duplicatePage } = usePageOps()
  const [busy, setBusy] = useState(false)
  const [previewIdx, setPreviewIdx] = useState<number | null>(null)

  // ── Drag state ────────────────────────────────────────────────────────────
  const gridRef = useRef<HTMLDivElement>(null)
  const cellRects = useRef<DOMRect[]>([])
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragDelta, setDragDelta] = useState({ x: 0, y: 0 })
  const [targetIdx, setTargetIdx] = useState<number | null>(null)
  const targetRef = useRef<number | null>(null)

  const measureCells = () => {
    const nodes = gridRef.current?.querySelectorAll('[data-page-cell]')
    cellRects.current = Array.from(nodes || []).map(n => n.getBoundingClientRect())
  }

  const startDrag = useCallback((e: React.PointerEvent, idx: number) => {
    e.preventDefault()
    e.stopPropagation()
    measureCells()
    const el = e.currentTarget as HTMLElement
    const pid = e.pointerId
    const startX = e.clientX, startY = e.clientY
    try { el.setPointerCapture(pid) } catch { /* detached */ }
    setDragIdx(idx)
    setDragDelta({ x: 0, y: 0 })
    setTargetIdx(idx)
    targetRef.current = idx

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return
      ev.preventDefault()
      setDragDelta({ x: ev.clientX - startX, y: ev.clientY - startY })
      // Target = the cell whose centre is nearest the pointer
      let best = idx, bestDist = Infinity
      cellRects.current.forEach((r, i) => {
        const d = Math.hypot(ev.clientX - (r.left + r.width / 2), ev.clientY - (r.top + r.height / 2))
        if (d < bestDist) { bestDist = d; best = i }
      })
      if (best !== targetRef.current) {
        targetRef.current = best
        setTargetIdx(best)
      }
    }
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      const to = targetRef.current
      if (to !== null && to !== idx) usePDFStore.getState().reorderPages(idx, to)
      setDragIdx(null); setTargetIdx(null); targetRef.current = null
      setDragDelta({ x: 0, y: 0 })
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
  }, [])

  /** Where card `i` should visually sit while a drag is in progress. */
  const shiftFor = (i: number): { x: number; y: number } => {
    if (dragIdx === null || targetIdx === null || i === dragIdx) return { x: 0, y: 0 }
    let newPos = i
    if (dragIdx < targetIdx && i > dragIdx && i <= targetIdx) newPos = i - 1
    else if (dragIdx > targetIdx && i >= targetIdx && i < dragIdx) newPos = i + 1
    if (newPos === i) return { x: 0, y: 0 }
    const from = cellRects.current[i], to = cellRects.current[newPos]
    if (!from || !to) return { x: 0, y: 0 }
    return { x: to.left - from.left, y: to.top - from.top }
  }

  if (!pdfDoc) return null

  const wrap = (fn: () => Promise<unknown>) => async () => {
    if (busy) return
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  return (
    <>
      <div
        ref={gridRef}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))',
          gap: 10,
          opacity: busy ? 0.6 : 1,
          pointerEvents: busy ? 'none' : 'auto',
        }}
      >
        {pageOrder.map((naturalIdx, i) => {
          const info = pageInfos[naturalIdx]
          const rotation = info?.rotation || 0
          const isCurrent = naturalIdx === currentPage
          const isDragging = dragIdx === i
          const shift = shiftFor(i)
          const moved = naturalIdx !== i
          const label = pageLabels[naturalIdx]
          // Portrait pages get a taller box; landscape a shorter one
          const ratio = info?.height && info?.width
            ? (rotation % 180 === 90 ? info.width / info.height : info.height / info.width)
            : 842 / 595

          return (
            <div
              key={naturalIdx}
              data-page-cell
              style={{
                position: 'relative',
                borderRadius: 14,
                background: isCurrent ? 'var(--color-mint)' : 'var(--color-surface-2)',
                padding: 6,
                outline: isDragging ? '2px solid var(--color-accent)'
                  : targetIdx === i && dragIdx !== null ? '2px dashed var(--color-accent)' : 'none',
                transform: isDragging
                  ? `translate(${dragDelta.x}px, ${dragDelta.y}px) scale(1.04)`
                  : `translate(${shift.x}px, ${shift.y}px)`,
                transition: isDragging ? 'none' : `transform 200ms ${EASE}`,
                zIndex: isDragging ? 20 : 1,
                boxShadow: isDragging ? '0 12px 32px rgba(0,0,0,0.25)' : 'none',
                touchAction: 'manipulation',
              }}
            >
              {/* Thumbnail — tap opens the full-screen preview */}
              <button
                onClick={() => setPreviewIdx(naturalIdx)}
                aria-label={`הצג עמוד ${i + 1} במסך מלא`}
                style={{
                  display: 'block', width: '100%', padding: 0, border: 'none',
                  background: 'white', borderRadius: 9, overflow: 'hidden',
                  aspectRatio: `1 / ${ratio}`,
                  cursor: 'zoom-in', minHeight: 0,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.14)',
                }}
              >
                <PageThumbLazy pdfDoc={pdfDoc} pageIndex={naturalIdx} rotation={rotation} />
              </button>

              {/* Drag handle — top-start corner, the only touch-action:none area
                  so the grid still scrolls normally */}
              <div
                onPointerDown={e => startDrag(e, i)}
                aria-label="גרור לשינוי סדר"
                title="גרור לשינוי סדר"
                style={{
                  position: 'absolute', top: 10, insetInlineStart: 10,
                  width: 30, height: 30, borderRadius: 8,
                  background: 'rgba(20,20,20,0.62)', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'grab', touchAction: 'none',
                  backdropFilter: 'blur(3px)',
                }}
              >
                <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/>
                  <circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/>
                  <circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/>
                </svg>
              </div>

              {/* Page number + state badges */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap',
                padding: '7px 3px 2px',
              }}>
                <span style={{
                  fontSize: 12.5, fontWeight: 700, color: 'var(--color-text)',
                  minWidth: 18,
                }}>{i + 1}</span>
                {moved && (
                  <span title={`הועבר ממיקום ${naturalIdx + 1}`} style={{
                    fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 20,
                    background: 'rgba(245,158,11,0.18)', color: '#b45309', whiteSpace: 'nowrap',
                  }}>הועבר · {naturalIdx + 1}</span>
                )}
                {label && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 20,
                    background: 'rgba(37,99,235,0.14)', color: '#2563eb', whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
                  }}>{label}</span>
                )}
                {rotation % 360 !== 0 && (
                  <span style={{ fontSize: 9.5, color: 'var(--color-text-muted)' }}>
                    ↻{((rotation % 360) + 360) % 360}°
                  </span>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-around', gap: 2 }}>
                <CardBtn label="סובב" onClick={() => { rotatePage(naturalIdx, 90); addToast(`עמוד ${i + 1} סובב`, 'success') }}>
                  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M4 9a8 8 0 1 1-2 5"/>
                  </svg>
                </CardBtn>
                <CardBtn label="שכפל" onClick={wrap(() => duplicatePage(i))}>
                  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                  </svg>
                </CardBtn>
                <CardBtn label="מחק" danger onClick={wrap(() => deletePage(i))}>
                  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </CardBtn>
              </div>
            </div>
          )
        })}
      </div>

      {previewIdx !== null && (
        <PagePreviewModal
          pdfDoc={pdfDoc}
          pageIndex={previewIdx}
          pageOrder={pageOrder}
          rotation={pageInfos[previewIdx]?.rotation || 0}
          onStep={delta => {
            const pos = pageOrder.indexOf(previewIdx)
            const next = pageOrder[pos + delta]
            if (next !== undefined) setPreviewIdx(next)
          }}
          onRotate={() => rotatePage(previewIdx, 90)}
          onGoToPage={onNavigate ? () => {
            setCurrentPage(previewIdx)
            setPreviewIdx(null)
            onNavigate()
          } : undefined}
          onClose={() => setPreviewIdx(null)}
        />
      )}
    </>
  )
}

const CardBtn: React.FC<{ label: string; danger?: boolean; onClick: () => void; children: React.ReactNode }> =
  ({ label, danger, onClick, children }) => (
    <button
      aria-label={label}
      title={label}
      onClick={e => { e.stopPropagation(); onClick() }}
      style={{
        flex: 1, height: 34, borderRadius: 9, border: 'none',
        background: 'transparent',
        color: danger ? 'var(--color-danger)' : 'var(--color-text-muted)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        WebkitTapHighlightColor: 'transparent',
        transition: `transform 120ms ${EASE}, background 120ms ease`,
        minHeight: 0, padding: 0,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(128,128,128,0.14)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
      onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.85)' }}
      onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
    >
      {children}
    </button>
  )

/** Thumbnail that renders only when scrolled into view, once per rotation. */
const PageThumbLazy: React.FC<{ pdfDoc: any; pageIndex: number; rotation: number }> = ({ pdfDoc, pageIndex, rotation }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { renderThumbnail } = usePDF()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // The "already rendered" flag belongs to this effect run, not to the
    // component. Keyed by page and rotation alone, it survived a rebuilt
    // document — so after deleting a page the cards kept the previous
    // document's pictures, which reads as though the wrong page was removed.
    let rendered = false
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !rendered) {
          rendered = true
          renderThumbnail(pdfDoc, pageIndex, canvas, THUMB_RES, rotation)
        }
      })
    }, { rootMargin: '300px' })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [pdfDoc, pageIndex, rotation, renderThumbnail])

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }}
    />
  )
}

/**
 * Full-screen page preview. The page is fitted to the viewport (no inner
 * scrolling), pages can be flipped without closing, and closing returns
 * straight back to the organize grid exactly where it was.
 */
const PagePreviewModal: React.FC<{
  pdfDoc: any
  pageIndex: number
  pageOrder: number[]
  rotation: number
  onStep: (delta: number) => void
  onRotate: () => void
  onGoToPage?: () => void
  onClose: () => void
}> = ({ pdfDoc, pageIndex, pageOrder, rotation, onStep, onRotate, onGoToPage, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { renderThumbnail } = usePDF()
  const [ready, setReady] = useState(false)

  const pos = pageOrder.indexOf(pageIndex)
  const hasPrev = pos > 0
  const hasNext = pos >= 0 && pos < pageOrder.length - 1

  // Render at a resolution matched to the screen so the fitted page is sharp
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    setReady(false)
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const width = Math.round(Math.min(window.innerWidth, 900) * dpr)
    let cancelled = false
    renderThumbnail(pdfDoc, pageIndex, canvas, width, rotation).then(() => {
      if (!cancelled) setReady(true)
    })
    return () => { cancelled = true }
  }, [pdfDoc, pageIndex, rotation, renderThumbnail])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      // RTL: ArrowLeft advances, ArrowRight goes back
      if (e.key === 'ArrowLeft' && hasNext) onStep(1)
      if (e.key === 'ArrowRight' && hasPrev) onStep(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onStep, hasPrev, hasNext])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 900,
        background: 'rgba(12,12,14,0.95)',
        display: 'flex', flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        direction: 'rtl',
      }}
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          flexShrink: 0, height: 56, display: 'flex', alignItems: 'center',
          gap: 10, padding: '0 14px', color: 'white',
        }}
      >
        <button
          onClick={onClose}
          aria-label="חזרה לארגון הדפים"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            height: 38, padding: '0 14px', borderRadius: 10, border: 'none',
            background: 'rgba(255,255,255,0.14)', color: 'white',
            cursor: 'pointer', fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit',
            minHeight: 0,
          }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          חזרה
        </button>

        <div style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 700 }}>
          עמוד {pos + 1} מתוך {pageOrder.length}
        </div>

        <button
          onClick={onRotate}
          aria-label="סובב עמוד"
          title="סובב עמוד"
          style={{
            width: 38, height: 38, borderRadius: 10, border: 'none',
            background: 'rgba(255,255,255,0.14)', color: 'white', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 0, padding: 0,
          }}
        >
          <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M4 9a8 8 0 1 1-2 5" />
          </svg>
        </button>

        {onGoToPage && (
          <button
            onClick={onGoToPage}
            style={{
              height: 38, padding: '0 14px', borderRadius: 10, border: 'none',
              background: 'var(--color-mint)', color: '#0f172a', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, fontFamily: 'inherit', minHeight: 0,
            }}
          >
            עבור לעמוד
          </button>
        )}
      </div>

      {/* Page — fitted to the remaining space, never needs scrolling */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          flex: 1, minHeight: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          padding: '0 clamp(8px, 3vw, 28px) 12px', position: 'relative',
        }}
      >
        <PreviewNavButton side="start" disabled={!hasPrev} onClick={() => onStep(-1)} />
        <canvas
          ref={canvasRef}
          style={{
            maxWidth: '100%', maxHeight: '100%',
            objectFit: 'contain',
            borderRadius: 6, background: 'white',
            boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
            opacity: ready ? 1 : 0,
            transition: `opacity 160ms ${EASE}`,
          }}
        />
        <PreviewNavButton side="end" disabled={!hasNext} onClick={() => onStep(1)} />
      </div>
    </div>
  )
}

/** Prev/next arrow pinned to the side of the preview. */
const PreviewNavButton: React.FC<{ side: 'start' | 'end'; disabled: boolean; onClick: () => void }> =
  ({ side, disabled, onClick }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={side === 'start' ? 'העמוד הקודם' : 'העמוד הבא'}
      style={{
        position: 'absolute', top: '50%', transform: 'translateY(-50%)',
        [side === 'start' ? 'insetInlineStart' : 'insetInlineEnd']: 6,
        width: 46, height: 46, borderRadius: '50%',
        // Solid dark disc: a translucent white one disappeared completely
        // over a white page, which is most of what gets previewed
        background: 'rgba(15,23,42,0.72)', color: '#fff',
        border: '1px solid rgba(255,255,255,0.35)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0 : 1, pointerEvents: disabled ? 'none' : 'auto',
        transition: 'opacity 160ms ease', minHeight: 0, padding: 0,
        zIndex: 2,
      } as React.CSSProperties}
    >
      {/* insetInlineStart puts "previous" on the RIGHT in Hebrew, so it is
          the one that points right — the two used to be swapped */}
      <svg width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round"
          d={side === 'start' ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'} />
      </svg>
    </button>
  )
