import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useAnnotationsStore, useUIStore } from '../../store'
import type { TextBoxAnnotation } from '../../store/types'
import { getFirstCharDirection } from '../../utils/textUtils'

interface Props {
  annotation: TextBoxAnnotation
}

export const TextBox: React.FC<Props> = ({ annotation }) => {
  const { updateAnnotation, deleteAnnotation, selectAnnotation, selectedId } = useAnnotationsStore()
  const { activeTool } = useUIStore()
  const isSelected = selectedId === annotation.id
  const contentRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const dragStart = useRef({ mx: 0, my: 0, ax: 0, ay: 0 })
  const isResizing = useRef(false)
  const resizeStart = useRef({ mx: 0, my: 0, w: 0, h: 0 })

  // Auto-detect text direction as user types
  const handleInput = () => {
    const text = contentRef.current?.textContent || ''
    const dir = annotation.direction === 'auto' ? getFirstCharDirection(text) : annotation.direction
    if (contentRef.current) {
      contentRef.current.style.direction = dir
    }
    updateAnnotation(annotation.id, { content: text })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      contentRef.current?.blur()
      selectAnnotation(null)
    }
    if (e.key === 'Delete' && !contentRef.current?.textContent) {
      deleteAnnotation(annotation.id)
    }
    e.stopPropagation()
  }

  // Drag
  const startDrag = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('resize-handle')) return
    if (activeTool !== 'select' && activeTool !== 'text') return
    e.preventDefault()
    e.stopPropagation()
    selectAnnotation(annotation.id)
    isDragging.current = true
    dragStart.current = { mx: e.clientX, my: e.clientY, ax: annotation.rect.x, ay: annotation.rect.y }

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return
      const dx = ev.clientX - dragStart.current.mx
      const dy = ev.clientY - dragStart.current.my
      updateAnnotation(annotation.id, { rect: { ...annotation.rect, x: dragStart.current.ax + dx, y: dragStart.current.ay + dy } })
    }
    const onUp = () => {
      isDragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Resize
  const startResize = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    isResizing.current = true
    resizeStart.current = { mx: e.clientX, my: e.clientY, w: annotation.rect.width, h: annotation.rect.height }

    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return
      const dw = ev.clientX - resizeStart.current.mx
      const dh = ev.clientY - resizeStart.current.my
      updateAnnotation(annotation.id, { rect: { ...annotation.rect,
        width: Math.max(80, resizeStart.current.w + dw),
        height: Math.max(24, resizeStart.current.h + dh)
      }})
    }
    const onUp = () => {
      isResizing.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (activeTool === 'eraser') { deleteAnnotation(annotation.id); return }
    selectAnnotation(annotation.id)
    if (activeTool === 'text' || activeTool === 'select') {
      contentRef.current?.focus()
    }
  }

  // Focus new empty text box
  useEffect(() => {
    if (annotation.content === '' && isSelected) {
      setTimeout(() => contentRef.current?.focus(), 50)
    }
  }, [isSelected])

  // Set initial direction
  useEffect(() => {
    if (contentRef.current) {
      const dir = annotation.direction === 'auto'
        ? getFirstCharDirection(annotation.content)
        : annotation.direction
      contentRef.current.style.direction = dir
      if (contentRef.current.textContent !== annotation.content) {
        contentRef.current.textContent = annotation.content
      }
    }
  }, [])

  const style: React.CSSProperties = {
    position: 'absolute',
    left: annotation.rect.x,
    top: annotation.rect.y,
    width: annotation.rect.width,
    minHeight: annotation.rect.height,
    border: isSelected ? '2px solid var(--color-accent)' : '2px dashed rgba(37,99,235,0.4)',
    background: 'transparent',
    cursor: activeTool === 'select' || activeTool === 'text' ? 'move' : 'default',
    zIndex: 30,
    userSelect: 'none'
  }

  return (
    <div style={style} onMouseDown={startDrag} onClick={handleClick}>
      <div
        ref={contentRef}
        contentEditable={activeTool === 'text' || isSelected}
        suppressContentEditableWarning
        className="text-box-inner"
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        style={{
          fontFamily: `'${annotation.fontFamily}', 'Heebo', sans-serif`,
          fontSize: annotation.fontSize,
          fontWeight: annotation.fontWeight,
          fontStyle: annotation.fontStyle,
          textDecoration: annotation.textDecoration,
          color: annotation.color,
          textAlign: annotation.align as any,
          direction: annotation.direction === 'auto' ? 'rtl' : annotation.direction,
          unicodeBidi: 'plaintext',
          outline: 'none',
          padding: '4px 6px',
          minHeight: annotation.rect.height - 4,
          wordBreak: 'break-word',
          cursor: activeTool === 'text' ? 'text' : 'move',
          whiteSpace: 'pre-wrap'
        }}
      />
      {/* Resize handle */}
      {isSelected && (
        <div
          className="resize-handle"
          onMouseDown={startResize}
          style={{
            position: 'absolute', bottom: -4, right: -4, width: 10, height: 10,
            background: 'var(--color-accent)', border: '1px solid white', borderRadius: 2,
            cursor: 'nwse-resize', zIndex: 31
          }}
        />
      )}
      {/* Delete button */}
      {isSelected && (
        <button
          onMouseDown={e => { e.stopPropagation(); deleteAnnotation(annotation.id) }}
          style={{
            position: 'absolute', top: -10, right: -10, width: 18, height: 18,
            background: 'var(--color-danger)', color: 'white', border: 'none',
            borderRadius: '50%', fontSize: 11, cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 32
          }}
        >×</button>
      )}
    </div>
  )
}
