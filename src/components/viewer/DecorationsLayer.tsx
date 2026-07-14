import React, { useState } from 'react'
import { usePDFStore, useUIStore } from '../../store'
import { startPointerDrag } from '../../utils/pointerDrag'

interface Props {
  pageIndex: number
  naturalWidth: number
  naturalHeight: number
  zoom: number
}

/**
 * Live watermark + page-number overlays. Rendered on every page, freely
 * draggable (offset is shared document-wide), edited or removed from the
 * tools panel — and baked into the file only on save/export.
 */
export const DecorationsLayer: React.FC<Props> = ({ pageIndex, naturalWidth, naturalHeight, zoom }) => {
  const { watermark, pageNumbers, setWatermark, setPageNumbers, pageOrder } = usePDFStore()
  const { activeTool } = useUIStore()
  const [hovered, setHovered] = useState<'wm' | 'pn' | null>(null)

  if (!watermark && !pageNumbers) return null

  const interactive = activeTool === 'select'

  const displayPos = pageOrder.length ? pageOrder.indexOf(pageIndex) : pageIndex

  const dragWatermark = (e: React.PointerEvent) => {
    if (!interactive || !watermark) return
    e.preventDefault(); e.stopPropagation()
    const start = { dx: watermark.dx, dy: watermark.dy }
    startPointerDrag(e, {
      onMove: (mx, my) => {
        setWatermark({ ...usePDFStore.getState().watermark!, dx: start.dx + mx / zoom, dy: start.dy + my / zoom })
      },
    })
  }

  const dragPageNumber = (e: React.PointerEvent) => {
    if (!interactive || !pageNumbers) return
    e.preventDefault(); e.stopPropagation()
    const start = { dx: pageNumbers.dx, dy: pageNumbers.dy }
    startPointerDrag(e, {
      onMove: (mx, my) => {
        setPageNumbers({ ...usePDFStore.getState().pageNumbers!, dx: start.dx + mx / zoom, dy: start.dy + my / zoom })
      },
    })
  }

  const side = Math.min(naturalWidth, naturalHeight) * 0.8

  const numberLabel = pageNumbers ? String(pageNumbers.startAt + Math.max(0, displayPos)) : ''
  const pnFontSize = 11
  const pnBaseX = pageNumbers
    ? pageNumbers.position === 'center' ? naturalWidth / 2
      : pageNumbers.position === 'right' ? naturalWidth - 40 : 40
    : 0

  return (
    <div
      style={{
        position: 'absolute', top: 0, left: 0,
        width: naturalWidth, height: naturalHeight,
        transform: `scale(${zoom})`,
        transformOrigin: 'top left',
        pointerEvents: 'none',
        zIndex: 12,
        overflow: 'hidden',
      }}
    >
      {/* Watermark */}
      {watermark?.text?.trim() && (
        <div
          onPointerDown={dragWatermark}
          onMouseEnter={() => interactive && setHovered('wm')}
          onMouseLeave={() => setHovered(null)}
          title={interactive ? 'גרור להזזת סימן המים (בכל הדפים)' : undefined}
          style={{
            position: 'absolute',
            left: (naturalWidth - side) / 2 + watermark.dx,
            top: (naturalHeight - side) / 2 + watermark.dy,
            width: side, height: side,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: interactive ? 'all' : 'none',
            cursor: interactive ? 'move' : 'default',
            touchAction: 'none',
            outline: hovered === 'wm' ? '1.5px dashed rgba(37,99,235,0.6)' : 'none',
            borderRadius: 8,
          }}
        >
          <span style={{
            transform: 'rotate(-45deg)',
            fontSize: watermark.fontSize * (side / 800),
            fontWeight: 700,
            fontFamily: "'Heebo', Arial, sans-serif",
            color: `rgba(0,0,0,${watermark.opacity})`,
            whiteSpace: 'nowrap',
            userSelect: 'none',
          }}>
            {watermark.text}
          </span>
        </div>
      )}

      {/* Page number */}
      {pageNumbers && displayPos >= 0 && (
        <div
          onPointerDown={dragPageNumber}
          onMouseEnter={() => interactive && setHovered('pn')}
          onMouseLeave={() => setHovered(null)}
          title={interactive ? 'גרור להזזת המספור (בכל הדפים)' : undefined}
          style={{
            position: 'absolute',
            left: pnBaseX + pageNumbers.dx,
            top: naturalHeight - 34 + pageNumbers.dy,
            transform: pageNumbers.position === 'center' ? 'translateX(-50%)'
              : pageNumbers.position === 'right' ? 'translateX(-100%)' : 'none',
            padding: '2px 8px',
            fontSize: pnFontSize,
            fontFamily: 'Arial, sans-serif',
            color: 'rgba(60,60,60,0.9)',
            pointerEvents: interactive ? 'all' : 'none',
            cursor: interactive ? 'move' : 'default',
            touchAction: 'none',
            outline: hovered === 'pn' ? '1.5px dashed rgba(37,99,235,0.6)' : 'none',
            borderRadius: 6,
            userSelect: 'none',
          }}
        >
          {numberLabel}
        </div>
      )}
    </div>
  )
}
