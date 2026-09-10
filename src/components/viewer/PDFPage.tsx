import React, { useEffect, useRef, useState } from 'react'
import { usePDF } from '../../hooks/usePDF'
import { usePDFStore, useUIStore } from '../../store'
import { AnnotationLayer } from './AnnotationLayer'
import { DecorationsLayer } from './DecorationsLayer'
import { FormFieldsLayer } from './FormFieldsLayer'
import { GuidesLayer } from './GuidesLayer'
import { TextEditLayer } from './TextEditLayer'
import { UnpaintedMarksLayer } from './UnpaintedMarksLayer'

interface Props {
  pageIndex: number
  isVisible: boolean
  isCurrent: boolean
}

export const PDFPage: React.FC<Props> = ({ pageIndex, isVisible }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { pdfDoc, zoom, pageInfos, setPageInfo } = usePDFStore()
  const { renderPage } = usePDF()
  const [renderedOnce, setRenderedOnce] = useState(false)
  const epochRef = useRef(0)

  const info = pageInfos[pageIndex]
  const rotation = info?.rotation || 0

  // The wrapper and canvas CSS size follow natural × zoom synchronously, so
  // zoom feedback is instant (the old bitmap stretches) and the crisp
  // re-render swaps in underneath without any layout shift.
  const naturalW = info?.width || 595
  const naturalH = info?.height || 842
  const cssW = Math.round(naturalW * zoom)
  const cssH = Math.round(naturalH * zoom)

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !isVisible) return
    const epoch = ++epochRef.current

    const doRender = async () => {
      const result = await renderPage(pdfDoc, pageIndex, canvasRef.current!, zoom, rotation)
      if (!result || epoch !== epochRef.current) return
      setPageInfo(pageIndex, { width: result.naturalWidth, height: result.naturalHeight })
      setRenderedOnce(true)
    }
    doRender()
  }, [pdfDoc, pageIndex, zoom, rotation, isVisible])

  // Release the bitmap when the page scrolls out of the render window.
  // Setting width/height to 0 is what actually frees the backing store —
  // dropping the React node alone would keep it alive until GC, and long
  // documents accumulated every visited page at full resolution.
  useEffect(() => {
    if (isVisible) return
    epochRef.current++ // invalidate any render still in flight
    const canvas = canvasRef.current
    if (canvas && canvas.width > 0) {
      canvas.width = 0
      canvas.height = 0
    }
    setRenderedOnce(false)
  }, [isVisible])

  if (!pdfDoc) return null

  // The wrapper keeps its full size even when unrendered, so scroll height
  // and scroll position stay stable as pages recycle.
  return (
    <div
      id={`page-${pageIndex}`}
      className="pdf-page-wrapper"
      style={{ width: cssW, minHeight: cssH }}
    >
      {!renderedOnce && (
        <div
          className="skeleton"
          style={{ width: cssW, height: cssH, position: 'absolute', top: 0, left: 0 }}
        />
      )}
      <canvas ref={canvasRef} className="pdf-canvas" style={{ width: cssW, height: cssH }} />
      {renderedOnce && (
        <UnpaintedMarksLayer
          pageIndex={pageIndex}
          naturalWidth={naturalW}
          naturalHeight={naturalH}
          zoom={zoom}
        />
      )}
      {renderedOnce && <SearchHighlights pageIndex={pageIndex} zoom={zoom} />}
      {renderedOnce && <FormFieldsLayer pageIndex={pageIndex} zoom={zoom} />}
      {renderedOnce && (
        <DecorationsLayer
          pageIndex={pageIndex}
          naturalWidth={naturalW}
          naturalHeight={naturalH}
          zoom={zoom}
        />
      )}
      {renderedOnce && (
        <GuidesLayer
          pageIndex={pageIndex}
          naturalWidth={naturalW}
          naturalHeight={naturalH}
          zoom={zoom}
        />
      )}
      {renderedOnce && (
        <TextEditLayer
          pageIndex={pageIndex}
          naturalWidth={naturalW}
          naturalHeight={naturalH}
          zoom={zoom}
        />
      )}
      {renderedOnce && (
        <AnnotationLayer
          pageIndex={pageIndex}
          naturalWidth={naturalW}
          naturalHeight={naturalH}
          zoom={zoom}
        />
      )}
    </div>
  )
}

/** Search-match highlights for this page (natural coords × zoom). */
const SearchHighlights: React.FC<{ pageIndex: number; zoom: number }> = ({ pageIndex, zoom }) => {
  const { searchMatches, searchActiveIdx } = useUIStore()
  const pageMatches = searchMatches
    .map((m, i) => ({ ...m, globalIdx: i }))
    .filter(m => m.pageIndex === pageIndex)
  if (!pageMatches.length) return null

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 9 }}>
      {pageMatches.map(m => (
        <div
          key={m.globalIdx}
          style={{
            position: 'absolute',
            left: m.rect.x * zoom - 2,
            top: m.rect.y * zoom - 2,
            width: m.rect.width * zoom + 4,
            height: m.rect.height * zoom + 4,
            background: m.globalIdx === searchActiveIdx ? 'rgba(255,150,0,0.45)' : 'rgba(255,220,0,0.35)',
            outline: m.globalIdx === searchActiveIdx ? '2px solid rgba(255,120,0,0.8)' : 'none',
            borderRadius: 3,
            mixBlendMode: 'multiply',
          }}
        />
      ))}
    </div>
  )
}
