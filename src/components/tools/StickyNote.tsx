import React, { useRef, useState } from 'react'
import { useAnnotationsStore, useUIStore } from '../../store'
import type { StickyAnnotation } from '../../store/types'
import { format } from 'date-fns'

interface Props { annotation: StickyAnnotation }

export const StickyNote: React.FC<Props> = ({ annotation }) => {
  const { updateAnnotation, deleteAnnotation } = useAnnotationsStore()
  const { activeTool } = useUIStore()
  const isDragging = useRef(false)
  const dragStart = useRef({ mx: 0, my: 0, ax: 0, ay: 0 })

  const startDrag = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'BUTTON') return
    e.preventDefault()
    isDragging.current = true
    dragStart.current = { mx: e.clientX, my: e.clientY, ax: annotation.position.x, ay: annotation.position.y }

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return
      updateAnnotation(annotation.id, { position: {
        x: dragStart.current.ax + ev.clientX - dragStart.current.mx,
        y: dragStart.current.ay + ev.clientY - dragStart.current.my
      }})
    }
    const onUp = () => { isDragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    updateAnnotation(annotation.id, { isOpen: !annotation.isOpen })
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: annotation.position.x,
        top: annotation.position.y,
        zIndex: 50,
        cursor: 'move'
      }}
      onMouseDown={startDrag}
    >
      {/* Pin icon */}
      <div
        onClick={handleClick}
        style={{
          width: 24, height: 24,
          background: '#fde047',
          border: '1px solid #ca8a04',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, cursor: 'pointer',
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
          style={{ position: 'absolute', top: 28, right: 0, minWidth: 180 }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 11 }}>{annotation.author}</span>
            <button
              onClick={() => deleteAnnotation(annotation.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#ca8a04', padding: 0 }}
            >×</button>
          </div>
          <textarea
            value={annotation.content}
            onChange={e => updateAnnotation(annotation.id, { content: e.target.value })}
            placeholder="הוסף הערה..."
            style={{
              width: '100%', minHeight: 80, border: 'none', background: 'transparent',
              resize: 'vertical', outline: 'none', fontFamily: 'inherit', fontSize: 12,
              direction: 'rtl', color: 'inherit'
            }}
            onMouseDown={e => e.stopPropagation()}
          />
          <div style={{ fontSize: 10, color: '#92400e', marginTop: 4 }}>
            {format(new Date(annotation.createdAt), 'dd/MM/yyyy HH:mm')}
          </div>
        </div>
      )}
    </div>
  )
}
