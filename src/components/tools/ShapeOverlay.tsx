import React from 'react'
import { useAnnotationsStore, useUIStore } from '../../store'
import type { ShapeAnnotation } from '../../store/types'
import { startPointerDrag } from '../../utils/pointerDrag'

interface Props { annotation: ShapeAnnotation; zoom: number }

export const ShapeOverlay: React.FC<Props> = ({ annotation, zoom }) => {
  const { updateAnnotation, deleteAnnotation, selectAnnotation, selectedId, pushHistory } = useAnnotationsStore()
  const { activeTool } = useUIStore()
  const isSelected = selectedId === annotation.id

  const handlePointerDown = (e: React.PointerEvent) => {
    if (activeTool !== 'select') return
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault(); e.stopPropagation()
    selectAnnotation(annotation.id)
    const start = { x: annotation.rect.x, y: annotation.rect.y }
    let pushed = false
    startPointerDrag(e, {
      onMove: (dx, dy) => {
        if (!pushed) { pushed = true; pushHistory() }
        updateAnnotation(annotation.id, { rect: { ...annotation.rect,
          x: start.x + dx / zoom,
          y: start.y + dy / zoom,
        }})
      },
    })
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
        touchAction: activeTool === 'select' ? 'none' : 'auto',
      }}
      onPointerDown={handlePointerDown}
      onClick={e => { e.stopPropagation(); if (activeTool === 'select') selectAnnotation(annotation.id) }}
    >
      <svg width={svgW} height={svgH} style={{ overflow: 'visible' }}>
        {renderShape()}
      </svg>
      {isSelected && (
        <button
          onPointerDown={e => { e.stopPropagation(); deleteAnnotation(annotation.id) }}
          style={{
            position: 'absolute', top: -14, right: -14, width: 28, height: 28,
            background: 'var(--color-danger)', color: 'white', border: '2px solid var(--color-surface)',
            borderRadius: '50%', fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 4px rgba(239,68,68,0.4)', padding: 0, minHeight: 0,
          }}
        >×</button>
      )}
    </div>
  )
}
