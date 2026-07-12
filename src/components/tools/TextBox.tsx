import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useAnnotationsStore, useUIStore } from '../../store'
import type { TextBoxAnnotation } from '../../store/types'
import { getFirstCharDirection } from '../../utils/textUtils'
import { startPointerDrag } from '../../utils/pointerDrag'

interface Props { annotation: TextBoxAnnotation; zoom: number }

const IS_COARSE = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

export const TextBox: React.FC<Props> = ({ annotation, zoom }) => {
  const { updateAnnotation, deleteAnnotation, selectAnnotation, selectedId } = useAnnotationsStore()
  const { activeTool } = useUIStore()
  const isSelected = selectedId === annotation.id
  const contentRef = useRef<HTMLDivElement>(null)
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

  const enterEditMode = useCallback((selectAll: boolean) => {
    selectAnnotation(annotation.id)
    setIsEditing(true)
    setTimeout(() => {
      const el = contentRef.current
      if (!el) return
      el.focus()
      if (selectAll) {
        const range = document.createRange()
        range.selectNodeContents(el)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
      // Keep the caret visible above the virtual keyboard
      if (IS_COARSE) setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
    }, 20)
  }, [annotation.id, selectAnnotation])

  // ── Pointer drag: move ────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement
    if (target.dataset.handle || target.closest('button')) return
    if (!isInteractive || isEditing) return
    e.stopPropagation()
    e.preventDefault()

    selectAnnotation(annotation.id)
    hasMoved.current = false
    const start = { x: annotation.rect.x, y: annotation.rect.y }

    startPointerDrag(e, {
      onMove: (dx, dy) => {
        hasMoved.current = true
        updateAnnotation(annotation.id, {
          rect: { ...annotation.rect, x: start.x + dx / zoom, y: start.y + dy / zoom }
        })
      },
      onEnd: (moved) => {
        if (moved) return
        // Tap / double-tap detection
        const now = Date.now()
        if (now - lastTapRef.current < 300) {
          enterEditMode(true)
        }
        lastTapRef.current = now
      },
    })
  }, [annotation.id, annotation.rect, isInteractive, isEditing, zoom, selectAnnotation, updateAnnotation, enterEditMode])

  const handleDblClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    enterEditMode(true)
  }, [enterEditMode])

  // ── Pointer drag: resize ──────────────────────────────────────────────────
  const handleResizeDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation(); e.preventDefault()
    const start = { w: annotation.rect.width, h: annotation.rect.height }
    startPointerDrag(e, {
      onMove: (dx, dy) => {
        updateAnnotation(annotation.id, {
          rect: { ...annotation.rect,
            width: Math.max(80, start.w + dx / zoom),
            height: Math.max(24, start.h + dy / zoom)
          }
        })
      },
    })
  }, [annotation.id, annotation.rect, zoom, updateAnnotation])

  // Auto-focus when newly created (empty box + selected)
  useEffect(() => {
    if (annotation.content === '' && isSelected && !isEditing) {
      enterEditMode(false)
    }
  }, [isSelected]) // eslint-disable-line react-hooks/exhaustive-deps

  // When deselected, stop editing mode
  useEffect(() => {
    if (!isSelected) setIsEditing(false)
  }, [isSelected])

  const showSolidBorder = isSelected
  const showHoverBorder = !isSelected && isHovered && isInteractive
  const border = showSolidBorder
    ? '2px solid var(--color-accent)'
    : showHoverBorder
    ? '1.5px dashed rgba(128,128,128,0.5)'
    : '1.5px dashed transparent'

  const dir = annotation.direction === 'auto'
    ? getFirstCharDirection(annotation.content)
    : annotation.direction

  const handleSize = IS_COARSE ? 28 : 14

  return (
    <div
      style={{
        position: 'absolute',
        left: annotation.rect.x,
        top: annotation.rect.y,
        width: annotation.rect.width,
        minHeight: annotation.rect.height,
        border,
        background: isSelected ? 'rgba(128,128,128,0.03)' : 'transparent',
        cursor: isInteractive ? (isEditing ? 'text' : 'move') : 'default',
        zIndex: isSelected ? 35 : 30,
        userSelect: 'none',
        borderRadius: 3,
        transition: 'border-color 120ms cubic-bezier(0.23,1,0.32,1), background 120ms ease',
        boxShadow: isSelected ? '0 0 0 3px rgba(128,128,128,0.12)' : 'none',
        pointerEvents: 'all',
        touchAction: isEditing ? 'auto' : 'none',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDblClick}
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
        onPointerDown={e => { if (isEditing) e.stopPropagation() }}
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
          {/* Resize handle — large invisible hit area, small visible dot */}
          <div
            data-handle="resize"
            onPointerDown={handleResizeDown}
            style={{
              position: 'absolute',
              bottom: -handleSize / 2, right: -handleSize / 2,
              width: handleSize, height: handleSize,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'nwse-resize',
              zIndex: 36,
              touchAction: 'none',
            }}
          >
            <div data-handle="resize" style={{
              width: 12, height: 12,
              background: 'var(--color-accent)',
              border: '2px solid var(--color-surface)',
              borderRadius: 3,
              boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
              pointerEvents: 'none',
            }} />
          </div>
          <button
            onPointerDown={e => { e.stopPropagation(); deleteAnnotation(annotation.id) }}
            style={{
              position: 'absolute', top: -14, right: -14,
              width: 28, height: 28,
              background: 'var(--color-danger)',
              color: 'white',
              border: '2px solid var(--color-surface)',
              borderRadius: '50%',
              fontSize: 15,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 36,
              lineHeight: 1,
              boxShadow: '0 1px 4px rgba(239,68,68,0.4)',
              padding: 0, minHeight: 0,
            }}
          >×</button>
          {!isEditing && annotation.content && (
            <div style={{
              position: 'absolute',
              top: annotation.rect.y < 30 ? '100%' : -24,
              marginTop: annotation.rect.y < 30 ? 4 : 0,
              left: 0,
              fontSize: 10, color: 'var(--color-text-muted)',
              background: 'var(--color-surface)', padding: '1px 5px', borderRadius: 3,
              border: '1px solid var(--color-border)',
              pointerEvents: 'none', whiteSpace: 'nowrap',
            }}>
              {IS_COARSE ? 'הקש פעמיים לעריכה' : 'לחץ פעמיים לעריכה'}
            </div>
          )}
        </>
      )}
    </div>
  )
}
