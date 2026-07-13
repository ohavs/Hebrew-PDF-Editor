import React from 'react'
import { useAnnotationsStore, useUIStore } from '../../store'
import type { SignatureAnnotation } from '../../store/types'
import { startPointerDrag } from '../../utils/pointerDrag'

interface Props { annotation: SignatureAnnotation; zoom: number }

const IS_COARSE = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

export const SignatureOverlay: React.FC<Props> = ({ annotation, zoom }) => {
  const { updateAnnotation, deleteAnnotation, selectAnnotation, selectedId } = useAnnotationsStore()
  const { activeTool } = useUIStore()
  const isSelected = selectedId === annotation.id

  // Draggable in select mode AND while the signature tool is active —
  // right after placing a signature the tool is still 'signature', and
  // positioning it is exactly what the user wants to do next.
  const canInteract = activeTool === 'select' || activeTool === 'signature'

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!canInteract) return
    const target = e.target as HTMLElement
    if (target.dataset.handle || target.closest('button')) return
    e.preventDefault(); e.stopPropagation()
    selectAnnotation(annotation.id)
    const start = { x: annotation.rect.x, y: annotation.rect.y }
    startPointerDrag(e, {
      onMove: (dx, dy) => {
        updateAnnotation(annotation.id, { rect: { ...annotation.rect,
          x: start.x + dx / zoom,
          y: start.y + dy / zoom,
        }})
      },
    })
  }

  const handleResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation(); e.preventDefault()
    const start = { w: annotation.rect.width }
    const ratio = annotation.rect.height / annotation.rect.width
    startPointerDrag(e, {
      onMove: (dx) => {
        const newW = Math.max(40, start.w + dx / zoom)
        updateAnnotation(annotation.id, { rect: { ...annotation.rect, width: newW, height: newW * ratio } })
      },
    })
  }

  const { x, y, width, height } = annotation.rect
  const handleSize = IS_COARSE ? 28 : 14

  return (
    <div
      style={{
        position: 'absolute', left: x, top: y, width, height,
        cursor: canInteract ? 'move' : 'default', zIndex: 35, userSelect: 'none',
        outline: isSelected ? '2px solid var(--color-accent)' : 'none',
        pointerEvents: 'all',
        touchAction: canInteract ? 'none' : 'auto',
      }}
      onPointerDown={handlePointerDown}
    >
      <img
        src={annotation.imageData}
        alt="חתימה"
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', pointerEvents: 'none' }}
        draggable={false}
      />
      {isSelected && (
        <>
          <div
            data-handle="resize"
            onPointerDown={handleResizeDown}
            style={{
              position: 'absolute',
              bottom: -handleSize / 2, right: -handleSize / 2,
              width: handleSize, height: handleSize,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'nwse-resize', touchAction: 'none',
            }}
          >
            <div data-handle="resize" style={{
              width: 12, height: 12,
              background: 'var(--color-accent)',
              border: '2px solid var(--color-surface)',
              borderRadius: 3,
              pointerEvents: 'none',
              boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }} />
          </div>
          <button
            onPointerDown={e => { e.stopPropagation(); deleteAnnotation(annotation.id) }}
            style={{
              position: 'absolute', top: -14, right: -14, width: 28, height: 28,
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
