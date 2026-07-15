import React from 'react'
import { useAnnotationsStore, useUIStore } from '../../store'
import type { StampAnnotation } from '../../store/types'
import { startPointerDrag } from '../../utils/pointerDrag'

interface Props { annotation: StampAnnotation; zoom: number }

export const StampOverlay: React.FC<Props> = ({ annotation, zoom }) => {
  const { updateAnnotation, deleteAnnotation, selectAnnotation, selectedId, pushHistory } = useAnnotationsStore()
  const { activeTool } = useUIStore()
  const isSelected = selectedId === annotation.id

  const canInteract = activeTool === 'select' || activeTool === 'stamp'

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!canInteract) return
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault(); e.stopPropagation()
    selectAnnotation(annotation.id)
    const start = { x: annotation.rect.x, y: annotation.rect.y }
    let pushed = false
    startPointerDrag(e, {
      onMove: (dx, dy) => {
        if (!pushed) { pushed = true; pushHistory() }
        updateAnnotation(annotation.id, { rect: { ...annotation.rect,
          x: start.x + dx / zoom,
          y: start.y + dy / zoom,
        }})
      },
    })
  }

  const { x, y, width, height } = annotation.rect
  return (
    <div
      style={{
        position: 'absolute', left: x, top: y,
        width, height,
        border: `2px solid ${annotation.color}`,
        borderRadius: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: `rotate(${annotation.rotation}deg)`,
        cursor: canInteract ? 'move' : 'default',
        opacity: 0.8,
        outline: isSelected ? '2px solid var(--color-accent)' : 'none',
        zIndex: 40,
        userSelect: 'none',
        pointerEvents: 'all',
        touchAction: canInteract ? 'none' : 'auto',
      }}
      onPointerDown={handlePointerDown}
      onClick={e => { e.stopPropagation(); if (activeTool === 'select') selectAnnotation(annotation.id) }}
    >
      <span style={{
        fontWeight: 700,
        fontSize: annotation.fontSize,
        color: annotation.color,
        fontFamily: annotation.isHebrew ? "'Heebo', sans-serif" : "'Arial', sans-serif",
        letterSpacing: 1,
        whiteSpace: 'nowrap'
      }}>
        {annotation.text}
      </span>
      {isSelected && (
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
      )}
    </div>
  )
}
