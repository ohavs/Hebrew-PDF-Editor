import React from 'react'
import { useAnnotationsStore } from '../../store'
import type { StickyAnnotation } from '../../store/types'
import { format } from 'date-fns'
import { startPointerDrag } from '../../utils/pointerDrag'

interface Props { annotation: StickyAnnotation; zoom: number }

export const StickyNote: React.FC<Props> = ({ annotation, zoom }) => {
  const { updateAnnotation, deleteAnnotation, pushHistory } = useAnnotationsStore()

  const handlePointerDown = (e: React.PointerEvent) => {
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'TEXTAREA' || tag === 'BUTTON') return
    e.preventDefault()
    e.stopPropagation()
    const start = { x: annotation.position.x, y: annotation.position.y }
    let pushed = false
    startPointerDrag(e, {
      onMove: (dx, dy) => {
        if (!pushed) { pushed = true; pushHistory() }
        updateAnnotation(annotation.id, { position: {
          x: start.x + dx / zoom,
          y: start.y + dy / zoom,
        }})
      },
      onEnd: (moved) => {
        if (!moved) updateAnnotation(annotation.id, { isOpen: !annotation.isOpen })
      },
    })
  }

  // Flip the popup to the other side when the pin is near the page edge (RTL: popup opens leftward)
  const popupSide = annotation.position.x < 200 ? { left: 0 } : { right: 0 }

  return (
    <div
      style={{
        position: 'absolute',
        left: annotation.position.x,
        top: annotation.position.y,
        zIndex: 50,
        cursor: 'move',
        pointerEvents: 'all',
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
      onClick={e => e.stopPropagation()}
    >
      {/* Pin icon */}
      <div
        style={{
          width: 32, height: 32,
          background: '#fde047',
          border: '1px solid #ca8a04',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, cursor: 'pointer',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}
        title={annotation.content || '...'}
      >
        📌
      </div>

      {/* Note popup */}
      {annotation.isOpen && (
        <div
          className="sticky-note"
          style={{ position: 'absolute', top: 36, minWidth: 180, ...popupSide }}
          onClick={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 11 }}>{annotation.author}</span>
            <button
              onClick={() => deleteAnnotation(annotation.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 16,
                color: '#ca8a04', padding: 0, width: 28, height: 28, minHeight: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >×</button>
          </div>
          <textarea
            value={annotation.content}
            onFocus={() => { if (annotation.content) pushHistory() }}
            onChange={e => updateAnnotation(annotation.id, { content: e.target.value })}
            placeholder="הוסף הערה..."
            style={{
              width: '100%', minHeight: 80, border: 'none', background: 'transparent',
              resize: 'vertical', outline: 'none', fontFamily: 'inherit', fontSize: 16,
              direction: 'rtl', color: 'inherit'
            }}
          />
          <div style={{ fontSize: 10, color: '#92400e', marginTop: 4 }}>
            {format(new Date(annotation.createdAt), 'dd/MM/yyyy HH:mm')}
          </div>
        </div>
      )}
    </div>
  )
}
