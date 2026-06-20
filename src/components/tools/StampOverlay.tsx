import React, { useRef } from 'react'
import { useAnnotationsStore, useUIStore } from '../../store'
import type { StampAnnotation } from '../../store/types'

interface Props { annotation: StampAnnotation }

export const StampOverlay: React.FC<Props> = ({ annotation }) => {
  const { updateAnnotation, deleteAnnotation, selectAnnotation, selectedId } = useAnnotationsStore()
  const { activeTool } = useUIStore()
  const isSelected = selectedId === annotation.id
  const isDragging = useRef(false)
  const dragStart = useRef({ mx: 0, my: 0, ax: 0, ay: 0 })

  const startDrag = (e: React.MouseEvent) => {
    if (activeTool !== 'select') return
    e.preventDefault(); e.stopPropagation()
    selectAnnotation(annotation.id)
    isDragging.current = true
    dragStart.current = { mx: e.clientX, my: e.clientY, ax: annotation.rect.x, ay: annotation.rect.y }
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return
      updateAnnotation(annotation.id, { rect: { ...annotation.rect,
        x: dragStart.current.ax + ev.clientX - dragStart.current.mx,
        y: dragStart.current.ay + ev.clientY - dragStart.current.my
      }})
    }
    const onUp = () => { isDragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
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
        cursor: activeTool === 'select' ? 'move' : 'default',
        opacity: 0.8,
        outline: isSelected ? '2px solid var(--color-accent)' : 'none',
        zIndex: 40,
        userSelect: 'none',
        pointerEvents: 'all',
      }}
      onMouseDown={startDrag}
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
          onMouseDown={e => { e.stopPropagation(); deleteAnnotation(annotation.id) }}
          style={{ position: 'absolute', top: -10, right: -10, width: 18, height: 18, background: 'var(--color-danger)', color: 'white', border: 'none', borderRadius: '50%', fontSize: 11, cursor: 'pointer' }}
        >×</button>
      )}
    </div>
  )
}
