import React, { useEffect, useRef, useCallback, useState } from 'react'
import { usePDF } from '../../hooks/usePDF'
import { usePDFStore, useAnnotationsStore, useUIStore } from '../../store'
import { AnnotationLayer } from './AnnotationLayer'
import type { PageInfo } from '../../store/types'

interface Props {
  pageIndex: number
  isVisible: boolean
  isCurrent: boolean
  onDimensionsChange?: (info: PageInfo) => void
}

export const PDFPage: React.FC<Props> = ({ pageIndex, isVisible, isCurrent, onDimensionsChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { pdfDoc, zoom, pageInfos } = usePDFStore()
  const { setPageInfo } = usePDFStore()
  const { renderPage } = usePDF()
  const [rendered, setRendered] = useState(false)
  const [dims, setDims] = useState({ w: 595, h: 842 })
  const renderTaskRef = useRef<any>(null)

  const info = pageInfos[pageIndex]
  const rotation = info?.rotation || 0

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !isVisible) return

    const doRender = async () => {
      setRendered(false)
      const result = await renderPage(pdfDoc, pageIndex, canvasRef.current!, zoom, rotation)
      if (result) {
        setDims({ w: result.width, h: result.height })
        setPageInfo(pageIndex, { width: result.width, height: result.height })
        onDimensionsChange?.({ index: pageIndex, width: result.width, height: result.height, rotation, scale: zoom })
        setRendered(true)
      }
    }
    doRender()
  }, [pdfDoc, pageIndex, zoom, rotation, isVisible])

  if (!pdfDoc) return null

  return (
    <div
      ref={wrapperRef}
      id={`page-${pageIndex}`}
      className="pdf-page-wrapper"
      style={{ width: dims.w, minHeight: dims.h }}
    >
      {!rendered && (
        <div
          className="skeleton"
          style={{ width: dims.w, height: dims.h, position: 'absolute', top: 0, left: 0 }}
        />
      )}
      <canvas ref={canvasRef} className="pdf-canvas" />
      {rendered && (
        <AnnotationLayer
          pageIndex={pageIndex}
          pageWidth={dims.w}
          pageHeight={dims.h}
        />
      )}
    </div>
  )
}
