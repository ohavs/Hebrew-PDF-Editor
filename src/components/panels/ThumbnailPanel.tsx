import React, { useEffect, useRef, useState, useCallback } from 'react'
import { usePDFStore, useUIStore } from '../../store'
import { usePDF } from '../../hooks/usePDF'
import { usePageOps } from '../../hooks/usePageOps'
import { useGridReorder } from '../../hooks/useGridReorder'

const EASE = 'cubic-bezier(0.23,1,0.32,1)'

interface MenuState { x: number; y: number; orderIdx: number; pageIdx: number }

/**
 * The page rail in the editor. Pages can be rearranged by dragging and acted
 * on straight from here — right-click, or the ⋯ button for touch and for
 * anyone who does not think to try right-click — so routine page work needs
 * no trip through the tools panel.
 */
export const ThumbnailPanel: React.FC = () => {
  const { pdfDoc, pageOrder, currentPage, setCurrentPage, reorderPages, pageInfos, rotatePage } = usePDFStore()
  const { addToast } = useUIStore()
  const { renderThumbnail } = usePDF()
  const { deletePage, duplicatePage, addBlankAfter } = usePageOps()
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [busy, setBusy] = useState(false)
  const thumbRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const renderedRef = useRef<Set<number>>(new Set())
  const observerRef = useRef<IntersectionObserver | null>(null)

  const reorder = useGridReorder((from, to) => reorderPages(from, to))

  const renderThumb = useCallback(async (pageIdx: number) => {
    if (!pdfDoc || renderedRef.current.has(pageIdx)) return
    const canvas = thumbRefs.current.get(pageIdx)
    if (!canvas) return
    renderedRef.current.add(pageIdx)
    await renderThumbnail(pdfDoc, pageIdx, canvas, 140)
  }, [pdfDoc, renderThumbnail])

  // Lazy rendering. Everything is dropped when the document is rebuilt, or
  // the rail would keep showing the pages of the document that just went away.
  useEffect(() => {
    if (!pdfDoc) return
    renderedRef.current.clear()
    thumbRefs.current.clear()

    observerRef.current = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          renderThumb(parseInt((entry.target as HTMLElement).dataset.pageIdx || '0'))
        }
      })
    }, { threshold: 0.01 })

    thumbRefs.current.forEach(canvas => observerRef.current?.observe(canvas))
    return () => observerRef.current?.disconnect()
  }, [pdfDoc, renderThumb])

  const setThumbRef = useCallback((pageIdx: number, canvas: HTMLCanvasElement | null) => {
    if (!canvas) return
    thumbRefs.current.set(pageIdx, canvas)
    if (observerRef.current) observerRef.current.observe(canvas)
    else renderThumb(pageIdx)
  }, [renderThumb])

  // Close the menu on anything that means "I'm doing something else now"
  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null) }
    window.addEventListener('pointerdown', close)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu])

  const openMenu = (e: React.MouseEvent, orderIdx: number, pageIdx: number) => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, orderIdx, pageIdx })
  }

  const run = (fn: () => Promise<unknown> | unknown) => async () => {
    setMenu(null)
    if (busy) return
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  if (!pdfDoc) return (
    <div style={{ padding: 16, color: 'var(--color-text-muted)', fontSize: 13, textAlign: 'center' }}>
      אין קובץ פתוח
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{
        padding: '8px 12px', borderBottom: '1px solid var(--color-border)',
        fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)',
      }}>
        תמונות ממוזערות ({pageOrder.length}) · קליק ימני לפעולות
      </div>

      <div
        ref={reorder.gridRef}
        style={{ flex: 1, overflowY: 'auto', padding: 8, opacity: busy ? 0.6 : 1, pointerEvents: busy ? 'none' : 'auto' }}
      >
        {pageOrder.map((pageIdx, orderIdx) => {
          const info = pageInfos[pageIdx]
          const rotation = info?.rotation || 0
          const isCurrent = currentPage === pageIdx
          const isDragging = reorder.dragIdx === orderIdx
          const shift = reorder.shiftFor(orderIdx)
          return (
            <div
              key={pageIdx}
              data-grid-cell
              data-thumb-item
              data-page-idx={pageIdx}
              onClick={() => setCurrentPage(pageIdx)}
              onContextMenu={e => openMenu(e, orderIdx, pageIdx)}
              style={{
                position: 'relative', cursor: 'pointer', padding: 6, borderRadius: 8, marginBottom: 6,
                border: `2px solid ${isCurrent ? 'var(--color-accent)'
                  : reorder.targetIdx === orderIdx && reorder.dragIdx !== null ? '#22c55e' : 'transparent'}`,
                background: isCurrent ? 'rgba(37,99,235,0.06)' : undefined,
                transform: isDragging
                  ? `translate(${reorder.delta.x}px, ${reorder.delta.y}px) scale(1.03)`
                  : `translate(${shift.x}px, ${shift.y}px)`,
                transition: isDragging ? 'none' : `transform 200ms ${EASE}, border-color 150ms ease`,
                zIndex: isDragging ? 20 : 1,
                boxShadow: isDragging ? '0 10px 26px rgba(0,0,0,0.25)' : 'none',
              }}
            >
              <div style={{
                position: 'relative', display: 'flex', justifyContent: 'center',
                background: 'white', borderRadius: 2, overflow: 'hidden',
                boxShadow: '0 1px 4px rgba(0,0,0,0.12)', transform: `rotate(${rotation}deg)`,
              }}>
                <canvas
                  ref={canvas => setThumbRef(pageIdx, canvas)}
                  data-page-idx={pageIdx}
                  style={{ display: 'block', maxWidth: '100%' }}
                />
              </div>

              {/* Drag grip — only this area takes the gesture, so the list
                  still scrolls with a finger */}
              <div
                onPointerDown={e => reorder.start(e, orderIdx)}
                aria-label="גרור לשינוי סדר"
                title="גרור לשינוי סדר"
                style={{
                  position: 'absolute', top: 10, insetInlineStart: 10,
                  width: 24, height: 24, borderRadius: 6,
                  background: 'rgba(20,20,20,0.6)', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'grab', touchAction: 'none',
                }}
              >
                <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/>
                  <circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/>
                  <circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/>
                </svg>
              </div>

              {/* Same menu as right-click, for touch and for discoverability */}
              <button
                aria-label={`פעולות לעמוד ${orderIdx + 1}`}
                onClick={e => openMenu(e, orderIdx, pageIdx)}
                style={{
                  position: 'absolute', top: 10, insetInlineEnd: 10,
                  width: 24, height: 24, borderRadius: 6, border: 'none',
                  background: 'rgba(20,20,20,0.6)', color: 'white', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  minHeight: 0, padding: 0, fontSize: 14, lineHeight: 1,
                }}
              >
                ⋯
              </button>

              <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                {orderIdx + 1}
              </div>
            </div>
          )
        })}
      </div>

      {menu && (
        <PageMenu
          menu={menu}
          onRotate={run(() => { rotatePage(menu.pageIdx, 90); addToast(`עמוד ${menu.orderIdx + 1} סובב`, 'success') })}
          onDuplicate={run(() => duplicatePage(menu.orderIdx))}
          onAddBlank={run(() => addBlankAfter(menu.orderIdx, info(pageInfos, menu.pageIdx)))}
          onDelete={run(() => deletePage(menu.orderIdx))}
        />
      )}
    </div>
  )
}

/** Page size for a new blank page, so it matches the one it follows. */
function info(pageInfos: Array<{ width: number; height: number } | undefined>, pageIdx: number): [number, number] | undefined {
  const i = pageInfos[pageIdx]
  return i ? [i.width, i.height] : undefined
}

const PageMenu: React.FC<{
  menu: MenuState
  onRotate: () => void
  onDuplicate: () => void
  onAddBlank: () => void
  onDelete: () => void
}> = ({ menu, onRotate, onDuplicate, onAddBlank, onDelete }) => {
  const items: Array<{ label: string; icon: string; onClick: () => void; danger?: boolean }> = [
    { label: 'סובב 90°', icon: '⟳', onClick: onRotate },
    { label: 'שכפל עמוד', icon: '⧉', onClick: onDuplicate },
    { label: 'הוסף דף ריק אחרי', icon: '＋', onClick: onAddBlank },
    { label: 'מחק עמוד', icon: '🗑', onClick: onDelete, danger: true },
  ]

  // Keep the menu on screen when the click lands near an edge
  const width = 190
  const height = items.length * 36 + 10
  const x = Math.min(menu.x, window.innerWidth - width - 8)
  const y = Math.min(menu.y, window.innerHeight - height - 8)

  return (
    <div
      role="menu"
      aria-label={`פעולות לעמוד ${menu.orderIdx + 1}`}
      data-page-menu
      onPointerDown={e => e.stopPropagation()}
      style={{
        position: 'fixed', top: y, insetInlineStart: undefined, left: x,
        width, zIndex: 4000,
        background: 'var(--color-surface)', color: 'var(--color-text)',
        border: '1px solid var(--color-border)', borderRadius: 12,
        boxShadow: '0 12px 34px rgba(0,0,0,0.24)', padding: 5,
      }}
    >
      {items.map(item => (
        <button
          key={item.label}
          role="menuitem"
          onClick={item.onClick}
          style={{
            display: 'flex', alignItems: 'center', gap: 9, width: '100%',
            padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'transparent', color: item.danger ? '#dc2626' : 'var(--color-text)',
            fontSize: 13, fontWeight: 600, fontFamily: 'inherit', textAlign: 'start', minHeight: 0,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-2)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
        >
          <span aria-hidden style={{ width: 16, textAlign: 'center' }}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  )
}
