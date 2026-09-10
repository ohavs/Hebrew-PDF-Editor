import React, { useState } from 'react'
import { stampConfig, stampText, stampApplies } from '../../utils/pageStamp'
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

  // The stamp reads whatever its template says on THIS page, and sits where
  // the anchor puts it — both worked out by the same code the export uses
  const stamp = pageNumbers ? stampConfig(pageNumbers) : null
  const total = pageOrder.length || 1
  const showStamp = Boolean(pageNumbers && displayPos >= 0 &&
    stampApplies(pageNumbers, displayPos, total))
  const stampLabel = pageNumbers && showStamp
    ? stampText(pageNumbers, displayPos, total)
    : ''

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

      {/* The running header or footer */}
      {stamp && showStamp && (
        <div
          data-page-stamp
          onPointerDown={dragPageNumber}
          onMouseEnter={() => interactive && setHovered('pn')}
          onMouseLeave={() => setHovered(null)}
          title={interactive ? 'גרור להזזה (בכל הדפים)' : undefined}
          style={{
            position: 'absolute',
            // The anchor is an edge, so the box is placed by its own edge too
            left: stamp.horizontal === 'left' ? stamp.margin + stamp.dx : undefined,
            right: stamp.horizontal === 'right' ? stamp.margin - stamp.dx : undefined,
            ...(stamp.horizontal === 'center'
              ? { left: naturalWidth / 2 + stamp.dx, transform: 'translateX(-50%)' }
              : null),
            top: stamp.vertical === 'top'
              ? stamp.margin - stamp.fontSize + stamp.dy
              : naturalHeight - stamp.margin + stamp.dy,
            padding: '2px 6px',
            fontSize: stamp.fontSize,
            fontWeight: stamp.bold ? 700 : 400,
            fontFamily: `'${stamp.fontFamily}', Arial, sans-serif`,
            color: stamp.color,
            whiteSpace: 'nowrap',
            pointerEvents: interactive ? 'all' : 'none',
            cursor: interactive ? 'move' : 'default',
            touchAction: 'none',
            outline: hovered === 'pn' ? '1.5px dashed rgba(37,99,235,0.6)' : 'none',
            borderRadius: 6,
            userSelect: 'none',
          }}
        >
          {stampLabel}
        </div>
      )}
    </div>
  )
}
