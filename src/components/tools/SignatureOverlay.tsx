import React, { useRef } from 'react'
import { useAnnotationsStore, useUIStore } from '../../store'
import type { SignatureAnnotation } from '../../store/types'

interface Props { annotation: SignatureAnnotation }

export const SignatureOverlay: React.FC<Props> = ({ annotation }) => {
  const { updateAnnotation, deleteAnnotation, selectAnnotation, selectedId } = useAnnotationsStore()
  const { activeTool } = useUIStore()
  const isSelected = selectedId === annotation.id
  const isDragging = useRef(false)
  const dragStart = useRef({ mx: 0, my: 0, ax: 0, ay: 0 })
  const isResizing = useRef(false)
  const resizeStart = useRef({ mx: 0, my: 0, w: 0, h: 0 })

  const startDrag = (e: React.MouseEvent) => {
    // eraser tool removed
    if ((e.target as HTMLElement).classList.contains('resize-handle')) return
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

  const startResize = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault()
    isResizing.current = true
    resizeStart.current = { mx: e.clientX, my: e.clientY, w: annotation.rect.width, h: annotation.rect.height }
    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return
      const dw = ev.clientX - resizeStart.current.mx
      const dh = ev.clientY - resizeStart.current.my
      const newW = Math.max(40, resizeStart.current.w + dw)
      const ratio = annotation.rect.height / annotation.rect.width
      updateAnnotation(annotation.id, { rect: { ...annotation.rect, width: newW, height: newW * ratio } })
    }
    const onUp = () => { isResizing.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  const { x, y, width, height } = annotation.rect
  return (
    <div
      style={{
        position: 'absolute', left: x, top: y, width, height,
        cursor: 'move', zIndex: 35, userSelect: 'none',
        outline: isSelected ? '2px solid var(--color-accent)' : 'none'
      }}
      onMouseDown={startDrag}
    >
      <img
        src={annotation.imageData}
        alt="חתימה"
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', pointerEvents: 'none' }}
        draggable={false}
      />
      {isSelected && (
        <>
          <div className="resize-handle" onMouseDown={startResize}
            style={{ position: 'absolute', bottom: -5, right: -5, width: 10, height: 10, background: 'var(--color-accent)', border: '1px solid white', borderRadius: 2, cursor: 'nwse-resize' }} />
          <button onMouseDown={e => { e.stopPropagation(); deleteAnnotation(annotation.id) }}
            style={{ position: 'absolute', top: -10, right: -10, width: 18, height: 18, background: 'var(--color-danger)', color: 'white', border: 'none', borderRadius: '50%', fontSize: 11, cursor: 'pointer' }}>×</button>
        </>
      )}
    </div>
  )
}
