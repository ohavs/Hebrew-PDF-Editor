import React, { useRef, useState } from 'react'
import { useAnnotationsStore, useUIStore } from '../../store'
import { TextBox } from '../tools/TextBox'
import { DrawingCanvas } from '../tools/DrawingCanvas'
import { StickyNote } from '../tools/StickyNote'
import { StampOverlay } from '../tools/StampOverlay'
import { SignatureOverlay } from '../tools/SignatureOverlay'
import { ShapeOverlay } from '../tools/ShapeOverlay'
import type { Point, Rect, TextBoxAnnotation, StickyAnnotation, StampAnnotation, HighlightAnnotation, ShapeAnnotation } from '../../store/types'

interface Props {
  pageIndex: number
  pageWidth: number
  pageHeight: number
}

export const AnnotationLayer: React.FC<Props> = ({ pageIndex, pageWidth, pageHeight }) => {
  const layerRef = useRef<HTMLDivElement>(null)
  const { annotations, addAnnotation, deleteAnnotation, selectedId, selectAnnotation, pushHistory } = useAnnotationsStore()
  const { activeTool, highlightColor, highlightOpacity, stampText, stampColor, stampIsHebrew,
          textFont, textSize, textBold, textItalic, textUnderline, textColor, textAlign, textDirection,
          authorName } = useUIStore()

  const [isDrawing, setIsDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState<Point | null>(null)
  const [tempRect, setTempRect] = useState<Rect | null>(null)

  const pageAnnotations = annotations.filter(a => a.pageIndex === pageIndex)

  const getRelativePos = (e: React.MouseEvent): Point => {
    const rect = layerRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const isInteractiveTool = ['highlight', 'underline', 'strikethrough', 'shapes', 'stamp', 'sticky', 'signature'].includes(activeTool)

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isInteractiveTool && activeTool !== 'text') return
    if ((e.target as HTMLElement).closest('.resize-handle')) return

    const pos = getRelativePos(e)

    if (activeTool === 'text') {
      pushHistory()
      const tb: Omit<TextBoxAnnotation, 'id' | 'createdAt'> = {
        type: 'textbox',
        pageIndex,
        rect: { x: pos.x, y: pos.y, width: 200, height: 40 },
        content: '',
        fontFamily: textFont,
        fontSize: textSize,
        fontWeight: textBold ? 'bold' : 'normal',
        fontStyle: textItalic ? 'italic' : 'normal',
        textDecoration: textUnderline ? 'underline' : 'none',
        color: textColor,
        align: textAlign,
        direction: textDirection,
        author: authorName
      }
      addAnnotation(tb)
      return
    }

    if (activeTool === 'sticky') {
      pushHistory()
      const sticky: Omit<StickyAnnotation, 'id' | 'createdAt'> = {
        type: 'sticky',
        pageIndex,
        position: pos,
        content: '',
        color: '#fef9c3',
        author: authorName || 'משתמש',
        isOpen: true
      }
      addAnnotation(sticky)
      return
    }

    if (activeTool === 'stamp') {
      pushHistory()
      const stamp: Omit<StampAnnotation, 'id' | 'createdAt'> = {
        type: 'stamp',
        pageIndex,
        rect: { x: pos.x - 60, y: pos.y - 20, width: 120, height: 40 },
        text: stampText,
        isHebrew: stampIsHebrew,
        color: stampColor,
        fontSize: 20,
        rotation: -15,
        author: authorName
      }
      addAnnotation(stamp)
      return
    }

    setIsDrawing(true)
    setDrawStart(pos)
    setTempRect({ x: pos.x, y: pos.y, width: 0, height: 0 })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !drawStart) return
    const pos = getRelativePos(e)
    setTempRect({
      x: Math.min(pos.x, drawStart.x),
      y: Math.min(pos.y, drawStart.y),
      width: Math.abs(pos.x - drawStart.x),
      height: Math.abs(pos.y - drawStart.y)
    })
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDrawing || !drawStart || !tempRect) { setIsDrawing(false); return }
    const pos = getRelativePos(e)
    const w = Math.abs(pos.x - drawStart.x)
    const h = Math.abs(pos.y - drawStart.y)

    if (w < 5 && h < 5) { setIsDrawing(false); setTempRect(null); return }

    const rect: Rect = {
      x: Math.min(pos.x, drawStart.x),
      y: Math.min(pos.y, drawStart.y),
      width: w,
      height: h
    }

    pushHistory()

    if (activeTool === 'highlight' || activeTool === 'underline' || activeTool === 'strikethrough') {
      const hl: Omit<HighlightAnnotation, 'id' | 'createdAt'> = {
        type: activeTool as 'highlight' | 'underline' | 'strikethrough',
        pageIndex,
        rect,
        color: highlightColor,
        opacity: highlightOpacity,
        author: authorName
      }
      addAnnotation(hl)
    } else if (activeTool === 'shapes') {
      const { shapeType, shapeFill, shapeStroke, shapeWidth } = useUIStore.getState()
      const shape: Omit<ShapeAnnotation, 'id' | 'createdAt'> = {
        type: 'shape',
        pageIndex,
        rect,
        shape: shapeType,
        strokeColor: shapeStroke,
        fillColor: shapeFill,
        strokeWidth: shapeWidth,
        opacity: 1,
        author: authorName
      }
      addAnnotation(shape)
    }

    setIsDrawing(false)
    setDrawStart(null)
    setTempRect(null)
  }

  const handleLayerClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement) === layerRef.current) {
      selectAnnotation(null)
    }
  }

  const isInteractive = isInteractiveTool || activeTool === 'text' || activeTool === 'draw'

  return (
    <div
      ref={layerRef}
      className="annotation-layer"
      style={{
        position: 'absolute', top: 0, left: 0,
        width: pageWidth, height: pageHeight,
        pointerEvents: isInteractive || activeTool === 'select' ? 'all' : 'none',
        cursor: activeTool === 'text' ? 'text'
          : activeTool === 'stamp' ? 'copy'
          : activeTool === 'sticky' ? 'cell'
          : isInteractiveTool ? 'crosshair'
          : 'default',
        zIndex: 10
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleLayerClick}
    >
      {/* Temp rect preview */}
      {isDrawing && tempRect && tempRect.width > 2 && (
        <div style={{
          position: 'absolute',
          left: tempRect.x, top: tempRect.y,
          width: tempRect.width, height: tempRect.height,
          border: '2px dashed rgba(37,99,235,0.6)',
          background: activeTool === 'highlight' ? highlightColor
            : 'rgba(37,99,235,0.05)',
          pointerEvents: 'none'
        }} />
      )}

      {/* Draw tool */}
      {activeTool === 'draw' && (
        <DrawingCanvas pageIndex={pageIndex} width={pageWidth} height={pageHeight} />
      )}

      {/* Render all page annotations */}
      {pageAnnotations.map(ann => {
        if (ann.type === 'textbox') {
          return <TextBox key={ann.id} annotation={ann} />
        }
        if (ann.type === 'highlight' || ann.type === 'underline' || ann.type === 'strikethrough') {
          return (
            <HighlightMark
              key={ann.id}
              id={ann.id}
              rect={ann.rect}
              color={ann.color}
              opacity={ann.opacity}
              type={ann.type}
              isSelected={selectedId === ann.id}
            />
          )
        }
        if (ann.type === 'sticky') {
          return <StickyNote key={ann.id} annotation={ann} />
        }
        if (ann.type === 'stamp') {
          return <StampOverlay key={ann.id} annotation={ann} />
        }
        if (ann.type === 'signature') {
          return <SignatureOverlay key={ann.id} annotation={ann} />
        }
        if (ann.type === 'shape') {
          return <ShapeOverlay key={ann.id} annotation={ann} />
        }
        return null
      })}
    </div>
  )
}

// Simple highlight/underline/strikethrough mark
const HighlightMark: React.FC<{
  id: string; rect: Rect; color: string; opacity: number;
  type: string; isSelected: boolean
}> = ({ id, rect, color, opacity, type, isSelected }) => {
  const { deleteAnnotation, selectAnnotation } = useAnnotationsStore()
  const { activeTool } = useUIStore()

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (activeTool === 'eraser') {
      deleteAnnotation(id)
    } else {
      selectAnnotation(id)
    }
  }

  const getStyle = (): React.CSSProperties => {
    if (type === 'underline') {
      return {
        position: 'absolute',
        left: rect.x, top: rect.y + rect.height - 3,
        width: rect.width, height: 3,
        background: color,
        opacity,
        cursor: 'pointer',
        pointerEvents: 'all',
        outline: isSelected ? '1px solid #2563eb' : 'none'
      }
    }
    if (type === 'strikethrough') {
      return {
        position: 'absolute',
        left: rect.x, top: rect.y + rect.height / 2 - 1.5,
        width: rect.width, height: 3,
        background: color,
        opacity,
        cursor: 'pointer',
        pointerEvents: 'all',
        outline: isSelected ? '1px solid #2563eb' : 'none'
      }
    }
    return {
      position: 'absolute',
      left: rect.x, top: rect.y,
      width: rect.width, height: rect.height,
      background: color,
      opacity,
      mixBlendMode: 'multiply' as const,
      cursor: 'pointer',
      pointerEvents: 'all',
      borderRadius: 2,
      outline: isSelected ? '2px solid #2563eb' : 'none'
    }
  }

  return <div style={getStyle()} onClick={handleClick} />
}
