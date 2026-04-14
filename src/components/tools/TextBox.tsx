import React, { useRef, useEffect } from 'react'
import { useAnnotationsStore, useUIStore } from '../../store'
import type { TextBoxAnnotation } from '../../store/types'
import { getFirstCharDirection } from '../../utils/textUtils'

interface Props { annotation: TextBoxAnnotation }

export const TextBox: React.FC<Props> = ({ annotation }) => {
  const { updateAnnotation, deleteAnnotation, selectAnnotation, selectedId } = useAnnotationsStore()
  const { activeTool, setTool } = useUIStore()
  const isSelected = selectedId === annotation.id
  const contentRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const dragStart = useRef({ mx: 0, my: 0, ax: 0, ay: 0 })
  const isResizing = useRef(false)
  const resizeStart = useRef({ mx: 0, my: 0, w: 0, h: 0 })
  const hasMoved = useRef(false)

  const handleInput = () => {
    const text = contentRef.current?.textContent || ''
    if (annotation.direction === 'auto' && contentRef.current) {
      contentRef.current.style.direction = getFirstCharDirection(text)
    }
    updateAnnotation(annotation.id, { content: text })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Escape') { contentRef.current?.blur(); selectAnnotation(null) }
  }

  // Drag to move
  const startDrag = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).dataset.handle) return
    e.preventDefault(); e.stopPropagation()
    selectAnnotation(annotation.id)
    hasMoved.current = false
    isDragging.current = true
    dragStart.current = { mx: e.clientX, my: e.clientY, ax: annotation.rect.x, ay: annotation.rect.y }

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return
      hasMoved.current = true
      updateAnnotation(annotation.id, {
        rect: { ...annotation.rect, x: dragStart.current.ax + ev.clientX - dragStart.current.mx, y: dragStart.current.ay + ev.clientY - dragStart.current.my }
      })
    }
    const onUp = () => { isDragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  // Click to focus (but don't re-create)
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (hasMoved.current) return
    selectAnnotation(annotation.id)
    if (activeTool === 'text' || activeTool === 'select') {
      setTimeout(() => contentRef.current?.focus(), 10)
    }
  }

  // Resize handle
  const startResize = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault()
    isResizing.current = true
    resizeStart.current = { mx: e.clientX, my: e.clientY, w: annotation.rect.width, h: annotation.rect.height }
    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return
      updateAnnotation(annotation.id, {
        rect: { ...annotation.rect,
          width: Math.max(80, resizeStart.current.w + ev.clientX - resizeStart.current.mx),
          height: Math.max(24, resizeStart.current.h + ev.clientY - resizeStart.current.my)
        }
      })
    }
    const onUp = () => { isResizing.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  // Sync content without re-triggering input
  useEffect(() => {
    if (!contentRef.current) return
    const dir = annotation.direction === 'auto' ? getFirstCharDirection(annotation.content) : annotation.direction
    contentRef.current.style.direction = dir
    if (contentRef.current.textContent !== annotation.content) {
      contentRef.current.textContent = annotation.content
    }
  }, [])

  // Auto-focus new empty box
  useEffect(() => {
    if (annotation.content === '' && isSelected) {
      setTimeout(() => contentRef.current?.focus(), 30)
    }
  }, [isSelected])

  const showBorder = isSelected || activeTool === 'text'

  return (
    <div
      style={{
        position: 'absolute', left: annotation.rect.x, top: annotation.rect.y,
        width: annotation.rect.width, minHeight: annotation.rect.height,
        border: showBorder
          ? `2px ${isSelected ? 'solid' : 'dashed'} ${isSelected ? 'var(--color-accent)' : 'rgba(37,99,235,0.35)'}`
          : 'none',
        background: 'transparent',
        cursor: activeTool === 'select' ? 'move' : 'text',
        zIndex: 30, userSelect: 'none'
      }}
      onMouseDown={startDrag}
      onClick={handleClick}
    >
      <div
        ref={contentRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        style={{
          outline: 'none', padding: '3px 6px',
          fontFamily: `'${annotation.fontFamily}', 'Heebo', sans-serif`,
          fontSize: annotation.fontSize, fontWeight: annotation.fontWeight,
          fontStyle: annotation.fontStyle, textDecoration: annotation.textDecoration,
          color: annotation.color, textAlign: annotation.align as any,
          direction: annotation.direction === 'auto' ? 'rtl' : annotation.direction,
          unicodeBidi: 'plaintext', wordBreak: 'break-word', whiteSpace: 'pre-wrap',
          cursor: 'text', minHeight: annotation.rect.height - 6
        }}
      />

      {isSelected && (
        <>
          {/* Resize handle */}
          <div
            data-handle="resize"
            onMouseDown={startResize}
            style={{
              position: 'absolute', bottom: -5, right: -5,
              width: 10, height: 10, background: 'var(--color-accent)',
              border: '1px solid white', borderRadius: 2, cursor: 'nwse-resize', zIndex: 31
            }}
          />
          {/* Delete */}
          <button
            onMouseDown={e => { e.stopPropagation(); deleteAnnotation(annotation.id) }}
            style={{
              position: 'absolute', top: -9, right: -9, width: 18, height: 18,
              background: 'var(--color-danger)', color: 'white', border: 'none',
              borderRadius: '50%', fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 32
            }}
          >×</button>
        </>
      )}
    </div>
  )
}
