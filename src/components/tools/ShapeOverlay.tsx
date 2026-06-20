import React, { useRef } from 'react'
import { useAnnotationsStore, useUIStore } from '../../store'
import type { ShapeAnnotation } from '../../store/types'

interface Props { annotation: ShapeAnnotation }

export const ShapeOverlay: React.FC<Props> = ({ annotation }) => {
  const { updateAnnotation, deleteAnnotation, selectAnnotation, selectedId } = useAnnotationsStore()
  const { activeTool } = useUIStore()
  const isSelected = selectedId === annotation.id
  const isDragging = useRef(false)
  const dragStart = useRef({ mx: 0, my: 0, ax: 0, ay: 0 })

  const startDrag = (e: React.MouseEvent) => {
    if (activeTool !== 'select') return
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

  const { x, y, width, height } = annotation.rect
  const sw = annotation.strokeWidth
  const svgW = width + sw * 2
  const svgH = height + sw * 2
  const ox = sw, oy = sw

  const renderShape = () => {
    const props = {
      stroke: annotation.strokeColor,
      strokeWidth: sw,
      fill: annotation.fillColor || 'none',
      opacity: annotation.opacity
    }
    switch (annotation.shape) {
      case 'rect':
        return <rect x={ox} y={oy} width={width} height={height} rx={2} {...props} />
      case 'ellipse':
        return <ellipse cx={ox + width/2} cy={oy + height/2} rx={width/2} ry={height/2} {...props} />
      case 'line':
        return <line x1={ox} y1={oy + height} x2={ox + width} y2={oy} {...props} />
      case 'arrow': {
        const x1 = ox, y1 = oy + height
        const x2 = ox + width, y2 = oy
        const dx = x2 - x1, dy = y2 - y1
        const len = Math.sqrt(dx*dx + dy*dy)
        if (len < 4) return null
        const headLen = Math.max(10, Math.min(24, len * 0.25))
        const angle = Math.atan2(dy, dx)
        const spread = 0.42 // radians (~24°)
        const tx = x2, ty = y2
        const p1x = tx - headLen * Math.cos(angle - spread)
        const p1y = ty - headLen * Math.sin(angle - spread)
        const p2x = tx - headLen * Math.cos(angle + spread)
        const p2y = ty - headLen * Math.sin(angle + spread)
        // Shorten line so it ends at arrowhead base midpoint
        const baseMidX = (p1x + p2x) / 2
        const baseMidY = (p1y + p2y) / 2
        return (
          <g>
            <line x1={x1} y1={y1} x2={baseMidX} y2={baseMidY}
              stroke={annotation.strokeColor} strokeWidth={sw} strokeLinecap="round" />
            <polygon
              points={`${tx},${ty} ${p1x},${p1y} ${p2x},${p2y}`}
              fill={annotation.strokeColor}
              stroke={annotation.strokeColor}
              strokeWidth={1}
              strokeLinejoin="round"
            />
          </g>
        )
      }
      default:
        return null
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: x - sw, top: y - sw,
        width: svgW, height: svgH,
        cursor: activeTool === 'select' ? 'move' : 'default',
        outline: isSelected ? '1px solid var(--color-accent)' : 'none',
        zIndex: 25,
        userSelect: 'none',
        pointerEvents: 'all',
      }}
      onMouseDown={startDrag}
      onClick={e => { e.stopPropagation(); if (activeTool === 'select') selectAnnotation(annotation.id) }}
    >
      <svg width={svgW} height={svgH} style={{ overflow: 'visible' }}>
        {renderShape()}
      </svg>
      {isSelected && (
        <button
          onMouseDown={e => { e.stopPropagation(); deleteAnnotation(annotation.id) }}
          style={{ position: 'absolute', top: -10, right: -10, width: 18, height: 18, background: 'var(--color-danger)', color: 'white', border: 'none', borderRadius: '50%', fontSize: 11, cursor: 'pointer' }}
        >×</button>
      )}
    </div>
  )
}
