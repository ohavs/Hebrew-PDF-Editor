import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useAnnotationsStore, useUIStore } from '../../store'
import type { TextBoxAnnotation } from '../../store/types'
import { getFirstCharDirection } from '../../utils/textUtils'

interface Props { annotation: TextBoxAnnotation }

export const TextBox: React.FC<Props> = ({ annotation }) => {
  const { updateAnnotation, deleteAnnotation, selectAnnotation, selectedId } = useAnnotationsStore()
  const { activeTool } = useUIStore()
  const isSelected = selectedId === annotation.id
  const contentRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const dragStart = useRef({ mx: 0, my: 0, ax: 0, ay: 0 })
  const isResizing = useRef(false)
  const resizeStart = useRef({ mx: 0, my: 0, w: 0, h: 0 })
  const hasMoved = useRef(false)
  const lastTapRef = useRef(0)
  const [isHovered, setIsHovered] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const isInteractive = activeTool === 'text' || activeTool === 'select'

  const handleInput = useCallback(() => {
    const text = contentRef.current?.textContent || ''
    if (annotation.direction === 'auto' && contentRef.current) {
      contentRef.current.style.direction = getFirstCharDirection(text)
    }
    updateAnnotation(annotation.id, { content: text })
  }, [annotation.id, annotation.direction, updateAnnotation])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Escape') {
      contentRef.current?.blur()
      setIsEditing(false)
      selectAnnotation(null)
    }
  }

  // Sync textContent only when not editing (avoid interrupting user input)
  useEffect(() => {
    if (isEditing || !contentRef.current) return
    const el = contentRef.current
    if (el.textContent !== annotation.content) {
      el.textContent = annotation.content
    }
  }, [annotation.content, isEditing])

  // Always sync direction from first character
  useEffect(() => {
    if (!contentRef.current || !isEditing) return
    const dir = annotation.direction === 'auto'
      ? getFirstCharDirection(annotation.content)
      : annotation.direction
    contentRef.current.style.direction = dir
  }, [annotation.direction, annotation.content, isEditing])

  const startDrag = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).dataset.handle) return
    if (!isInteractive) return
    if (isEditing) return  // Don't drag while editing
    e.stopPropagation()
    e.preventDefault()

    selectAnnotation(annotation.id)
    hasMoved.current = false
    isDragging.current = true
    dragStart.current = { mx: e.clientX, my: e.clientY, ax: annotation.rect.x, ay: annotation.rect.y }

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return
      const dx = ev.clientX - dragStart.current.mx
      const dy = ev.clientY - dragStart.current.my
      if (Math.abs(dx) + Math.abs(dy) > 3) hasMoved.current = true
      updateAnnotation(annotation.id, {
        rect: { ...annotation.rect, x: dragStart.current.ax + dx, y: dragStart.current.ay + dy }
      })
    }
    const onUp = () => {
      isDragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [annotation.id, annotation.rect, isInteractive, isEditing, selectAnnotation, updateAnnotation])

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (hasMoved.current) return
    selectAnnotation(annotation.id)
  }, [annotation.id, selectAnnotation])

  const handleDblClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    selectAnnotation(annotation.id)
    setIsEditing(true)
    setTimeout(() => {
      const el = contentRef.current
      if (!el) return
      el.focus()
      // Select all text on double-click (like a regular input field)
      const range = document.createRange()
      range.selectNodeContents(el)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }, 20)
  }, [annotation.id, selectAnnotation])

  const startResize = useCallback((e: React.MouseEvent) => {
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
    const onUp = () => {
      isResizing.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [annotation.id, annotation.rect, updateAnnotation])

  // ── Touch: drag to move ───────────────────────────────────────────────────
  const startTouchDrag = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).dataset.handle) return
    if (!isInteractive) return
    if (isEditing) return
    if (e.touches.length !== 1) return
    e.stopPropagation()
    e.preventDefault()

    const touch = e.touches[0]
    selectAnnotation(annotation.id)
    hasMoved.current = false
    isDragging.current = true
    dragStart.current = { mx: touch.clientX, my: touch.clientY, ax: annotation.rect.x, ay: annotation.rect.y }

    const onMove = (ev: TouchEvent) => {
      if (!isDragging.current || ev.touches.length !== 1) return
      const t = ev.touches[0]
      const dx = t.clientX - dragStart.current.mx
      const dy = t.clientY - dragStart.current.my
      if (Math.abs(dx) + Math.abs(dy) > 3) hasMoved.current = true
      updateAnnotation(annotation.id, {
        rect: { ...annotation.rect, x: dragStart.current.ax + dx, y: dragStart.current.ay + dy }
      })
      ev.preventDefault()
    }
    const onEnd = () => {
      isDragging.current = false
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
  }, [annotation.id, annotation.rect, isInteractive, isEditing, selectAnnotation, updateAnnotation])

  // Touch tap / double-tap
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.stopPropagation()
    if (hasMoved.current) return
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      // Double-tap → enter edit mode, select all
      selectAnnotation(annotation.id)
      setIsEditing(true)
      setTimeout(() => {
        const el = contentRef.current
        if (!el) return
        el.focus()
        const range = document.createRange()
        range.selectNodeContents(el)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
      }, 20)
    } else {
      selectAnnotation(annotation.id)
    }
    lastTapRef.current = now
  }, [annotation.id, selectAnnotation])

  // Auto-focus when newly created (empty box + selected)
  useEffect(() => {
    if (annotation.content === '' && isSelected && !isEditing) {
      setIsEditing(true)
      setTimeout(() => contentRef.current?.focus(), 30)
    }
  }, [isSelected]) // eslint-disable-line react-hooks/exhaustive-deps

  // When deselected, stop editing mode
  useEffect(() => {
    if (!isSelected) setIsEditing(false)
  }, [isSelected])

  const showSolidBorder = isSelected
  const showHoverBorder = !isSelected && isHovered && isInteractive
  const border = showSolidBorder
    ? '2px solid var(--color-ink-black)'
    : showHoverBorder
    ? '1.5px dashed rgba(0,0,0,0.3)'
    : '1.5px dashed transparent'

  const dir = annotation.direction === 'auto'
    ? getFirstCharDirection(annotation.content)
    : annotation.direction

  return (
    <div
      style={{
        position: 'absolute',
        left: annotation.rect.x,
        top: annotation.rect.y,
        width: annotation.rect.width,
        minHeight: annotation.rect.height,
        border,
        background: isSelected ? 'rgba(0,0,0,0.015)' : 'transparent',
        cursor: isInteractive ? (isEditing ? 'text' : 'move') : 'default',
        zIndex: isSelected ? 35 : 30,
        userSelect: 'none',
        borderRadius: 3,
        transition: 'border-color 120ms cubic-bezier(0.23,1,0.32,1), background 120ms ease',
        boxShadow: isSelected ? '0 0 0 3px rgba(0,0,0,0.08)' : 'none',
        pointerEvents: 'all',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={startDrag}
      onClick={handleClick}
      onDoubleClick={handleDblClick}
      onTouchStart={startTouchDrag}
      onTouchEnd={handleTouchEnd}
    >
      <div
        ref={contentRef}
        contentEditable={isEditing}
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsEditing(true)}
        onBlur={() => {
          setTimeout(() => setIsEditing(false), 100)
        }}
        onMouseDown={e => { if (isEditing) e.stopPropagation() }}
        onClick={e => e.stopPropagation()}
        style={{
          outline: 'none',
          padding: '4px 7px',
          fontFamily: `'${annotation.fontFamily}', 'Heebo', sans-serif`,
          fontSize: annotation.fontSize,
          fontWeight: annotation.fontWeight,
          fontStyle: annotation.fontStyle,
          textDecoration: annotation.textDecoration,
          color: annotation.color,
          textAlign: annotation.align as any,
          direction: dir,
          unicodeBidi: 'plaintext',
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
          cursor: isEditing ? 'text' : 'inherit',
          minHeight: annotation.rect.height - 8,
          userSelect: isEditing ? 'text' : 'none',
        }}
      />

      {isSelected && (
        <>
          <div
            data-handle="resize"
            onMouseDown={startResize}
            style={{
              position: 'absolute', bottom: -5, right: -5,
              width: 10, height: 10,
              background: 'var(--color-ink-black)',
              border: '2px solid white',
              borderRadius: 2,
              cursor: 'nwse-resize',
              zIndex: 36,
              boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            }}
          />
          <button
            onMouseDown={e => { e.stopPropagation(); deleteAnnotation(annotation.id) }}
            style={{
              position: 'absolute', top: -11, right: -11,
              width: 20, height: 20,
              background: 'var(--color-danger)',
              color: 'white',
              border: '2px solid white',
              borderRadius: '50%',
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 36,
              lineHeight: 1,
              boxShadow: '0 1px 4px rgba(239,68,68,0.4)',
            }}
          >×</button>
          {!isEditing && annotation.content && (
            <div style={{
              position: 'absolute', top: -22, left: 0,
              fontSize: 10, color: 'var(--color-graphite)',
              background: 'white', padding: '1px 5px', borderRadius: 3,
              border: '1px solid var(--color-border)',
              pointerEvents: 'none', whiteSpace: 'nowrap',
            }}>
              לחץ פעמיים לעריכה
            </div>
          )}
        </>
      )}
    </div>
  )
}
