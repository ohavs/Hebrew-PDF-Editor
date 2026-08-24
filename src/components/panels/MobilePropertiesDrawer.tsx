import React, { useState, useEffect, useRef } from 'react'
import { useUIStore, useAnnotationsStore } from '../../store'
import { PropertiesPanel } from './PropertiesPanel'
import { ObjectActions } from './ObjectActions'
import { startPointerDrag } from '../../utils/pointerDrag'
import type { ToolType } from '../../store/types'

// Tools with real, adjustable properties. Others (eraser, underline,
// strikethrough, redact, comment) get no drawer — it would only cover
// the canvas with useless content.
const TOOLS_WITH_PROPS: ToolType[] = ['text', 'draw', 'highlight', 'underline', 'strikethrough', 'shapes', 'stamp', 'signature']

/** Past this many pixels of downward drag, let go and it closes. */
const DISMISS_DISTANCE = 90

export const MobilePropertiesDrawer: React.FC = () => {
  const { activeTool } = useUIStore()
  const { selectedId } = useAnnotationsStore()
  const [isOpen, setIsOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)

  // Also reachable with a plain object selected in select mode, or the layer
  // and duplicate actions would be desktop-only
  const hasProps = TOOLS_WITH_PROPS.includes(activeTool) || !!selectedId

  // Picking a tool no longer throws its settings over the page — the settings
  // button opens them when they are actually wanted. Switching tools does
  // close whatever was open, since it belonged to the previous tool.
  useEffect(() => { setIsOpen(false) }, [activeTool])

  /** Drag the sheet down to dismiss, the way every mobile sheet behaves. */
  const startDismissDrag = (e: React.PointerEvent) => {
    const el = drawerRef.current
    if (!el) return
    e.preventDefault()
    el.style.transition = 'none'
    startPointerDrag(e, {
      onMove: (_dx, dy) => {
        // Rubber-band upward instead of letting the sheet fly off the top
        const offset = dy > 0 ? dy : dy / 4
        el.style.transform = `translateY(${offset}px)`
      },
      onEnd: () => {
        el.style.transition = ''
        const shifted = new DOMMatrixReadOnly(getComputedStyle(el).transform).m42
        el.style.transform = ''
        if (shifted > DISMISS_DISTANCE) setIsOpen(false)
      },
    })
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="mobile-only"
          style={{ position: 'fixed', inset: 0, zIndex: 449, background: 'rgba(0,0,0,0.18)' }}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`mobile-props-drawer mobile-only${isOpen ? '' : ' hidden'}`}
        role="dialog"
        aria-modal="true"
        aria-label="הגדרות כלי"
      >
        <div
          className="mobile-props-grip"
          onPointerDown={startDismissDrag}
          onClick={() => setIsOpen(false)}
        >
          <div className="mobile-props-handle" />
        </div>
        <ObjectActions />
        <PropertiesPanel />
      </div>

      {/* Floating settings button — above the bottom nav, only for tools with settings */}
      {!isOpen && hasProps && (
        <button
          className="mobile-only"
          aria-label="הגדרות כלי"
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: 'calc(var(--bottom-nav-height, 80px) + 12px)',
            insetInlineEnd: 14,
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'var(--color-accent)',
            color: 'var(--color-on-accent)',
            border: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 448,
            transition: 'transform 150ms cubic-bezier(0.23,1,0.32,1)',
            WebkitTapHighlightColor: 'transparent',
            minHeight: 0, padding: 0,
          }}
          onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.9)' }}
          onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
          </svg>
        </button>
      )}
    </>
  )
}
