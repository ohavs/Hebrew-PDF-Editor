import React, { useRef, useState, useEffect } from 'react'
import { useAnnotationsStore, useUIStore } from '../../store'
import type { Point, Rect, TextBoxAnnotation, StampAnnotation, HighlightAnnotation, ShapeAnnotation, StickyAnnotation } from '../../store/types'
import { DrawingCanvas } from '../tools/DrawingCanvas'
import { TextBox } from '../tools/TextBox'
import { StampOverlay } from '../tools/StampOverlay'
import { SignatureOverlay } from '../tools/SignatureOverlay'
import { ShapeOverlay } from '../tools/ShapeOverlay'
import { StickyNote } from '../tools/StickyNote'

interface Props {
  pageIndex: number
  /** Natural (zoom-1) page display size — annotation coordinate space */
  naturalWidth: number
  naturalHeight: number
  zoom: number
}

export const AnnotationLayer: React.FC<Props> = ({ pageIndex, naturalWidth, naturalHeight, zoom }) => {
  const layerRef = useRef<HTMLDivElement>(null)
  const { annotations, addAnnotation, deleteAnnotation, selectedId, selectAnnotation, pushHistory } = useAnnotationsStore()
  const { activeTool, highlightColor, highlightOpacity, stampText, stampColor, stampIsHebrew,
          textFont, textSize, textBold, textItalic, textUnderline, textColor, textAlign, textDirection,
          shapeType, shapeFill, shapeStroke, shapeWidth } = useUIStore()

  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState<Point | null>(null)
  const [tempRect, setTempRect] = useState<Rect | null>(null)
  const selectedAtMouseDown = useRef<string | null>(null)
  const multiTouchRef = useRef(false)

  const pageAnnotations = annotations.filter(a => a.pageIndex === pageIndex)

  // Non-passive touch listeners: prevent the scroll container from scrolling
  // while a tool draws with a single finger. Two-finger gestures pass through
  // to the browser/pinch handler (touchAction: 'pinch-zoom' below).
  useEffect(() => {
    const el = layerRef.current
    if (!el || activeTool === 'select') return
    const prevent = (e: TouchEvent) => { if (e.touches.length === 1) e.preventDefault() }
    el.addEventListener('touchstart', prevent, { passive: false })
    el.addEventListener('touchmove',  prevent, { passive: false })
    return () => {
      el.removeEventListener('touchstart', prevent)
      el.removeEventListener('touchmove',  prevent)
    }
  }, [activeTool])

  useEffect(() => {
    if (activeTool !== 'text') {
      const state = useAnnotationsStore.getState()
      state.annotations
        .filter(a => a.type === 'textbox' && !(a as TextBoxAnnotation).content?.trim())
        .forEach(a => state.deleteAnnotation(a.id))
    }
  }, [activeTool])

  /** Pointer position in natural page coordinates (zoom-independent). */
  const getRelativePos = (clientX: number, clientY: number): Point => {
    const rect = layerRef.current!.getBoundingClientRect()
    return { x: (clientX - rect.left) / zoom, y: (clientY - rect.top) / zoom }
  }

  const isRectTool = ['highlight', 'shapes', 'underline', 'strikethrough', 'redact'].includes(activeTool)

  // ── Shared interaction logic ──────────────────────────────────────────────

  const handleInteractStart = (clientX: number, clientY: number, targetEl: EventTarget | null) => {
    // Point-creation tools only fire on empty layer space — child annotations
    // handle their own pointer events.
    if ((activeTool === 'text' || activeTool === 'comment') && (targetEl as HTMLElement) !== layerRef.current) return
    selectedAtMouseDown.current = selectedId
    const pos = getRelativePos(clientX, clientY)

    if (activeTool === 'eraser') {
      const drawAnns = pageAnnotations.filter(a => a.type === 'draw')
      const nearby = drawAnns.find(a => {
        const points = (a as any).points as Point[]
        return points.some(p => Math.hypot(p.x - pos.x, p.y - pos.y) < 15 / zoom)
      })
      if (nearby) { pushHistory(); deleteAnnotation(nearby.id) }
      return
    }

    if (activeTool === 'comment') {
      pushHistory()
      const sticky: Omit<StickyAnnotation, 'id' | 'createdAt'> = {
        type: 'sticky', pageIndex,
        position: pos,
        content: '', color: '#fef08a',
        author: '', isOpen: true
      }
      addAnnotation(sticky)
      return
    }

    if (activeTool === 'text') {
      if (selectedAtMouseDown.current) {
        selectAnnotation(null)
        const deselected = annotations.find(a => a.id === selectedAtMouseDown.current)
        if (deselected?.type === 'textbox' && !(deselected as TextBoxAnnotation).content?.trim()) {
          deleteAnnotation(deselected.id)
        }
        return
      }
      pushHistory()
      const tb: Omit<TextBoxAnnotation, 'id' | 'createdAt'> = {
        type: 'textbox', pageIndex,
        rect: { x: pos.x, y: pos.y, width: 220, height: 44 },
        content: '', fontFamily: textFont, fontSize: textSize,
        fontWeight: textBold ? 'bold' : 'normal',
        fontStyle: textItalic ? 'italic' : 'normal',
        textDecoration: textUnderline ? 'underline' : 'none',
        color: textColor, align: textAlign, direction: textDirection
      }
      // Select it as it appears: the box focuses itself when it mounts
      // selected, so the keyboard comes up and you can just type. Without
      // this you got an empty dashed box and had to hunt for a double-tap.
      selectAnnotation(addAnnotation(tb))
      return
    }

    if (activeTool === 'stamp') {
      pushHistory()
      const stamp: Omit<StampAnnotation, 'id' | 'createdAt'> = {
        type: 'stamp', pageIndex,
        rect: { x: pos.x - 60, y: pos.y - 20, width: 120, height: 40 },
        text: stampText, isHebrew: stampIsHebrew,
        color: stampColor, fontSize: 20, rotation: -15
      }
      addAnnotation(stamp)
      return
    }

    if (isRectTool) {
      setIsDrawing(true)
      setDrawStart(pos)
      setTempRect({ x: pos.x, y: pos.y, width: 0, height: 0 })
    }
  }

  const handleInteractMove = (clientX: number, clientY: number) => {
    if (!isDrawing || !drawStart) return
    const pos = getRelativePos(clientX, clientY)
    setTempRect({
      x: Math.min(pos.x, drawStart.x), y: Math.min(pos.y, drawStart.y),
      width: Math.abs(pos.x - drawStart.x), height: Math.abs(pos.y - drawStart.y)
    })
  }

  const cancelDrawing = () => { setIsDrawing(false); setDrawStart(null); setTempRect(null) }

  const handleInteractEnd = (clientX: number, clientY: number) => {
    if (!isDrawing || !drawStart || !tempRect) { setIsDrawing(false); return }
    const pos = getRelativePos(clientX, clientY)
    const w = Math.abs(pos.x - drawStart.x)
    const h = Math.abs(pos.y - drawStart.y)
    if (w < 5 && h < 5) { cancelDrawing(); return }

    const rect: Rect = {
      x: Math.min(pos.x, drawStart.x), y: Math.min(pos.y, drawStart.y), width: w, height: h
    }
    pushHistory()

    if (activeTool === 'highlight' || activeTool === 'underline' || activeTool === 'strikethrough') {
      const hl: Omit<HighlightAnnotation, 'id' | 'createdAt'> = {
        type: activeTool, pageIndex, rect,
        color: highlightColor, opacity: highlightOpacity
      }
      addAnnotation(hl)
    } else if (activeTool === 'shapes') {
      const { shapeType, shapeFill, shapeStroke, shapeWidth } = useUIStore.getState()
      const shape: Omit<ShapeAnnotation, 'id' | 'createdAt'> = {
        type: 'shape', pageIndex, rect,
        shape: shapeType, strokeColor: shapeStroke,
        fillColor: shapeFill, strokeWidth: shapeWidth, opacity: 1
      }
      addAnnotation(shape)
    } else if (activeTool === 'redact') {
      const shape: Omit<ShapeAnnotation, 'id' | 'createdAt'> = {
        type: 'shape', pageIndex, rect,
        shape: 'rect', strokeColor: '#000000',
        fillColor: '#000000', strokeWidth: 0, opacity: 1
      }
      addAnnotation(shape)
    }

    cancelDrawing()
  }

  // ── Mouse handlers ────────────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    handleInteractStart(e.clientX, e.clientY, e.target)
  }
  const handleMouseMove = (e: React.MouseEvent) => handleInteractMove(e.clientX, e.clientY)
  const handleMouseUp   = (e: React.MouseEvent) => handleInteractEnd(e.clientX, e.clientY)

  const handleLayerClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement) === layerRef.current && activeTool !== 'text') {
      selectAnnotation(null)
    }
  }

  // ── Touch handlers ────────────────────────────────────────────────────────
  const handleTouchStart = (e: React.TouchEvent) => {
    if (activeTool === 'select') return
    if (e.touches.length !== 1) { multiTouchRef.current = true; cancelDrawing(); return }
    multiTouchRef.current = false
    const t = e.touches[0]
    handleInteractStart(t.clientX, t.clientY, e.target)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) { multiTouchRef.current = true; cancelDrawing(); return }
    const t = e.touches[0]
    handleInteractMove(t.clientX, t.clientY)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (multiTouchRef.current) { if (e.touches.length === 0) multiTouchRef.current = false; return }
    const t = e.changedTouches[0]
    handleInteractEnd(t.clientX, t.clientY)
  }

  const handleTouchCancel = () => { multiTouchRef.current = false; cancelDrawing() }

  // ── Cursor ────────────────────────────────────────────────────────────────
  const cursor =
    activeTool === 'text' ? 'text' :
    activeTool === 'stamp' ? 'copy' :
    activeTool === 'comment' ? 'cell' :
    activeTool === 'eraser' ? 'cell' :
    isRectTool ? 'crosshair' :
    activeTool === 'draw' ? 'crosshair' : 'default'

  return (
    <div
      ref={layerRef}
      style={{
        position: 'absolute', top: 0, left: 0,
        width: naturalWidth, height: naturalHeight,
        transform: `scale(${zoom})`,
        transformOrigin: 'top left',
        pointerEvents: activeTool === 'select' ? 'none' : 'all',
        cursor, zIndex: 10,
        // Two fingers always reach the browser: scroll/pinch while annotating
        touchAction: activeTool === 'select' ? 'auto' : 'pinch-zoom',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleLayerClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      {isDrawing && tempRect && tempRect.width > 2 && (() => {
        const r = tempRect
        if (activeTool === 'highlight') {
          return (
            <div style={{
              position: 'absolute', left: r.x, top: r.y, width: r.width, height: r.height,
              background: highlightColor, opacity: highlightOpacity,
              mixBlendMode: 'multiply' as const, pointerEvents: 'none', borderRadius: 2,
            }} />
          )
        }
        if (activeTool === 'underline') {
          return (
            <div style={{
              position: 'absolute', left: r.x, top: r.y, width: r.width, height: r.height,
              borderBottom: `2px solid ${highlightColor}`, pointerEvents: 'none',
            }} />
          )
        }
        if (activeTool === 'strikethrough') {
          return (
            <div style={{
              position: 'absolute', left: r.x, top: r.y, width: r.width, height: r.height,
              pointerEvents: 'none',
            }}>
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 2, background: highlightColor, transform: 'translateY(-50%)' }} />
            </div>
          )
        }
        if (activeTool === 'redact') {
          return (
            <div style={{
              position: 'absolute', left: r.x, top: r.y, width: r.width, height: r.height,
              background: '#000000', opacity: 0.85, pointerEvents: 'none', borderRadius: 2,
            }} />
          )
        }
        if (activeTool === 'shapes') {
          const sw = shapeWidth
          const svgW = r.width + sw * 2, svgH = r.height + sw * 2
          const ox = sw, oy = sw
          const shapeProps = { stroke: shapeStroke, strokeWidth: sw, fill: shapeFill !== 'transparent' ? shapeFill : 'none', opacity: 0.85 }
          let shapeEl: React.ReactNode = null
          if (shapeType === 'rect') shapeEl = <rect x={ox} y={oy} width={r.width} height={r.height} rx={2} {...shapeProps} />
          else if (shapeType === 'ellipse') shapeEl = <ellipse cx={ox + r.width/2} cy={oy + r.height/2} rx={r.width/2} ry={r.height/2} {...shapeProps} />
          else if (shapeType === 'line') shapeEl = <line x1={ox} y1={oy + r.height} x2={ox + r.width} y2={oy} stroke={shapeStroke} strokeWidth={sw} />
          else if (shapeType === 'arrow') {
            const x1 = ox, y1 = oy + r.height, x2 = ox + r.width, y2 = oy
            const dx = x2-x1, dy = y2-y1, len = Math.sqrt(dx*dx+dy*dy)
            if (len >= 4) {
              const hl = Math.max(10, Math.min(24, len*0.25)), ang = Math.atan2(dy,dx), sp = 0.42
              const tx = x2, ty = y2
              const p1x = tx-hl*Math.cos(ang-sp), p1y = ty-hl*Math.sin(ang-sp)
              const p2x = tx-hl*Math.cos(ang+sp), p2y = ty-hl*Math.sin(ang+sp)
              const bmx = (p1x+p2x)/2, bmy = (p1y+p2y)/2
              shapeEl = <g>
                <line x1={x1} y1={y1} x2={bmx} y2={bmy} stroke={shapeStroke} strokeWidth={sw} strokeLinecap="round"/>
                <polygon points={`${tx},${ty} ${p1x},${p1y} ${p2x},${p2y}`} fill={shapeStroke} />
              </g>
            }
          }
          return (
            <svg style={{ position: 'absolute', left: r.x - sw, top: r.y - sw, overflow: 'visible', pointerEvents: 'none' }}
              width={svgW} height={svgH}>
              {shapeEl}
            </svg>
          )
        }
        return null
      })()}

      <DrawingCanvas pageIndex={pageIndex} width={naturalWidth} height={naturalHeight} zoom={zoom} />

      {pageAnnotations.map(ann => {
        if (ann.type === 'draw') return null
        if (ann.type === 'textbox') return <TextBox key={ann.id} annotation={ann} zoom={zoom} />
        if (ann.type === 'highlight' || ann.type === 'underline' || ann.type === 'strikethrough') {
          return <HighlightMark key={ann.id} id={ann.id} rect={(ann as HighlightAnnotation).rect}
            color={(ann as HighlightAnnotation).color} opacity={(ann as HighlightAnnotation).opacity}
            type={ann.type} isSelected={selectedId === ann.id} />
        }
        if (ann.type === 'stamp') return <StampOverlay key={ann.id} annotation={ann as StampAnnotation} zoom={zoom} />
        if (ann.type === 'signature') return <SignatureOverlay key={ann.id} annotation={ann as any} zoom={zoom} />
        if (ann.type === 'shape') return <ShapeOverlay key={ann.id} annotation={ann as ShapeAnnotation} zoom={zoom} />
        if (ann.type === 'sticky') return <StickyNote key={ann.id} annotation={ann as StickyAnnotation} zoom={zoom} />
        return null
      })}
    </div>
  )
}

const HighlightMark: React.FC<{
  id: string; rect: Rect; color: string; opacity: number; type: string; isSelected: boolean
}> = ({ id, rect, color, opacity, type, isSelected }) => {
  const { deleteAnnotation, selectAnnotation } = useAnnotationsStore()
  const { activeTool } = useUIStore()

  const isHighlight = type === 'highlight'
  const isUnderline = type === 'underline'
  const isStrike = type === 'strikethrough'

  return (
    <div
      style={{
        position: 'absolute', left: rect.x, top: rect.y,
        width: rect.width, height: rect.height,
        background: isHighlight ? color : 'transparent',
        opacity: isHighlight ? opacity : 1,
        mixBlendMode: isHighlight ? 'multiply' as const : 'normal' as const,
        cursor: 'pointer', pointerEvents: 'all', borderRadius: 2,
        outline: isSelected ? '2px solid var(--color-accent)' : 'none',
        borderBottom: isUnderline ? `2px solid ${color}` : 'none',
      }}
      onClick={e => { e.stopPropagation(); if (activeTool === 'select') selectAnnotation(id) }}
    >
      {isStrike && (
        <div style={{
          position: 'absolute', top: '50%', left: 0, right: 0,
          height: 2, background: color, transform: 'translateY(-50%)'
        }} />
      )}
      {isSelected && (
        <button
          onPointerDown={e => { e.stopPropagation(); deleteAnnotation(id) }}
          style={{
            position: 'absolute', top: -14, right: -14, width: 28, height: 28,
            background: 'var(--color-danger)', color: 'white', border: '2px solid white',
            borderRadius: '50%', fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 32,
            boxShadow: '0 1px 4px rgba(239,68,68,0.4)', padding: 0, minHeight: 0,
          }}
        >×</button>
      )}
    </div>
  )
}
