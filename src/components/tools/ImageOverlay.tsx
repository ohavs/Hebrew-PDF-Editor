import React from 'react'
import { useAnnotationsStore, useUIStore } from '../../store'
import type { ImageAnnotation } from '../../store/types'
import { startPointerDrag } from '../../utils/pointerDrag'

interface Props { annotation: ImageAnnotation; zoom: number }

const IS_COARSE = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
const MIN_SIZE = 24

type Corner = 'nw' | 'ne' | 'se' | 'sw'

/**
 * A picture on the page: drag to move, resize from any corner, rotate from the
 * stem above it. Corners keep the aspect ratio — hold Shift to distort — which
 * is the behaviour every layout tool has and the one people expect.
 */
export const ImageOverlay: React.FC<Props> = ({ annotation, zoom }) => {
  const { updateAnnotation, deleteAnnotation, selectAnnotation, selectedId, pushHistory } = useAnnotationsStore()
  const { activeTool } = useUIStore()
  const isSelected = selectedId === annotation.id
  const canInteract = activeTool === 'select' || activeTool === 'image'

  const { x, y, width, height } = annotation.rect
  const handleSize = IS_COARSE ? 30 : 16

  const move = (e: React.PointerEvent) => {
    if (!canInteract) return
    const target = e.target as HTMLElement
    if (target.dataset.handle || target.closest('button')) return
    e.preventDefault(); e.stopPropagation()
    selectAnnotation(annotation.id)
    const start = { x, y }
    let pushed = false
    startPointerDrag(e, {
      onMove: (dx, dy) => {
        if (!pushed) { pushed = true; pushHistory() }
        updateAnnotation(annotation.id, {
          rect: { ...annotation.rect, x: start.x + dx / zoom, y: start.y + dy / zoom },
        })
      },
    })
  }

  const resize = (corner: Corner) => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation()
    selectAnnotation(annotation.id)
    const start = { ...annotation.rect }
    const ratio = start.height / start.width || 1
    // Shift is read per-move, so it can be pressed or released mid-drag
    let pushed = false
    startPointerDrag(e, {
      onMove: (dx, dy, ev) => {
        if (!pushed) { pushed = true; pushHistory() }
        const free = ev.shiftKey
        const mx = dx / zoom
        const my = dy / zoom
        // Which way each axis grows depends on the corner being dragged
        const growX = corner === 'ne' || corner === 'se' ? mx : -mx
        const growY = corner === 'sw' || corner === 'se' ? my : -my

        let w = Math.max(MIN_SIZE, start.width + growX)
        let h = Math.max(MIN_SIZE, start.height + growY)
        if (!free) {
          // Let the larger movement lead so the drag tracks the pointer
          if (Math.abs(growX) >= Math.abs(growY)) h = Math.max(MIN_SIZE, w * ratio)
          else w = Math.max(MIN_SIZE, h / ratio)
        }
        // The opposite corner stays put
        const nx = corner === 'nw' || corner === 'sw' ? start.x + start.width - w : start.x
        const ny = corner === 'nw' || corner === 'ne' ? start.y + start.height - h : start.y
        updateAnnotation(annotation.id, { rect: { x: nx, y: ny, width: w, height: h } })
      },
    })
  }

  const rotate = (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation()
    selectAnnotation(annotation.id)
    const el = (e.currentTarget as HTMLElement).closest('[data-image-object]') as HTMLElement
    const box = el.getBoundingClientRect()
    const cx = box.left + box.width / 2
    const cy = box.top + box.height / 2
    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx)
    const startRotation = annotation.rotation
    let pushed = false
    startPointerDrag(e, {
      onMove: (_dx, _dy, ev) => {
        if (!pushed) { pushed = true; pushHistory() }
        const angle = Math.atan2(ev.clientY - cy, ev.clientX - cx)
        let deg = startRotation + (angle - startAngle) * 180 / Math.PI
        // Snap to the straight angles unless Shift asks for precision
        if (!ev.shiftKey) {
          const near = Math.round(deg / 15) * 15
          if (Math.abs(deg - near) < 5) deg = near
        }
        updateAnnotation(annotation.id, { rotation: ((deg % 360) + 360) % 360 })
      },
    })
  }

  const corners: Array<{ id: Corner; top: number | string; left?: number | string; right?: number | string; bottom?: number | string; cursor: string }> = [
    { id: 'nw', top: -handleSize / 2, left: -handleSize / 2, cursor: 'nwse-resize' },
    { id: 'ne', top: -handleSize / 2, right: -handleSize / 2, cursor: 'nesw-resize' },
    { id: 'se', top: 'auto', bottom: -handleSize / 2, right: -handleSize / 2, cursor: 'nwse-resize' },
    { id: 'sw', top: 'auto', bottom: -handleSize / 2, left: -handleSize / 2, cursor: 'nesw-resize' },
  ]

  return (
    <div
      data-image-object={annotation.id}
      style={{
        position: 'absolute', left: x, top: y, width, height,
        transform: annotation.rotation ? `rotate(${annotation.rotation}deg)` : undefined,
        cursor: canInteract ? 'move' : 'default',
        zIndex: 30, userSelect: 'none', pointerEvents: 'all',
        touchAction: canInteract ? 'none' : 'auto',
        outline: isSelected ? '2px solid var(--color-accent)' : 'none',
        outlineOffset: 1,
      }}
      onPointerDown={move}
      onClick={e => e.stopPropagation()}
    >
      <img
        src={annotation.imageData}
        alt=""
        style={{
          width: '100%', height: '100%', objectFit: 'fill', display: 'block',
          pointerEvents: 'none', opacity: annotation.opacity,
          borderRadius: annotation.cornerRadius * zoom,
        }}
        draggable={false}
      />

      {isSelected && canInteract && (
        <>
          {corners.map(c => (
            <div
              key={c.id}
              data-handle={`resize-${c.id}`}
              onPointerDown={resize(c.id)}
              style={{
                position: 'absolute',
                top: c.top as any, left: c.left as any, right: c.right as any, bottom: c.bottom as any,
                width: handleSize, height: handleSize,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: c.cursor, touchAction: 'none',
              }}
            >
              <div data-handle={`resize-${c.id}`} style={{
                width: 12, height: 12, background: 'var(--color-accent)',
                border: '2px solid var(--color-surface)', borderRadius: 3,
                pointerEvents: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
              }} />
            </div>
          ))}

          {/* Rotation stem */}
          <div
            data-handle="rotate"
            aria-label="סובב תמונה"
            onPointerDown={rotate}
            style={{
              position: 'absolute', top: -handleSize - 18, left: `calc(50% - ${handleSize / 2}px)`,
              width: handleSize, height: handleSize,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'grab', touchAction: 'none',
            }}
          >
            <div data-handle="rotate" style={{
              width: 14, height: 14, borderRadius: '50%',
              background: 'var(--color-surface)', border: '2px solid var(--color-accent)',
              pointerEvents: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }} />
          </div>
          <div style={{
            position: 'absolute', top: -18, left: '50%', width: 2, height: 18,
            background: 'var(--color-accent)', pointerEvents: 'none', opacity: 0.7,
          }} />

          <button
            aria-label="מחק תמונה"
            onPointerDown={e => { e.stopPropagation(); pushHistory(); deleteAnnotation(annotation.id) }}
            style={{
              position: 'absolute', top: -14, insetInlineEnd: -14, width: 28, height: 28,
              background: 'var(--color-danger)', color: 'white', border: '2px solid var(--color-surface)',
              borderRadius: '50%', fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 1px 4px rgba(239,68,68,0.4)', padding: 0, minHeight: 0,
            }}
          >×</button>
        </>
      )}
    </div>
  )
}
