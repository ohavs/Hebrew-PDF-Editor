import React, { useEffect, useRef, useState } from 'react'
import { usePDF } from '../../hooks/usePDF'
import { usePDFStore } from '../../store'
import { AnnotationLayer } from './AnnotationLayer'

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

  if (!pdfDoc) return null

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
