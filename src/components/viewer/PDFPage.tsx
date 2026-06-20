import React, { useEffect, useRef, useCallback, useState } from 'react'
import { usePDF } from '../../hooks/usePDF'
import { usePDFStore, useUIStore } from '../../store'
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
  const { pdfDoc, zoom, pageInfos, setCurrentPage } = usePDFStore()
  const { setPageInfo } = usePDFStore()
  const { activeTool } = useUIStore()
  const { renderPage } = usePDF()
  const [rendered, setRendered] = useState(false)
  const [dims, setDims] = useState({ w: 595, h: 842 })

  const info = pageInfos[pageIndex]
  const rotation = info?.rotation || 0
  const isPagesToolActive = activeTool === 'toolbox'

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
      style={{
        width: dims.w,
        minHeight: dims.h,
        // When pages tool is active, clicking on the page selects it
        cursor: isPagesToolActive ? 'pointer' : undefined,
        // Highlight selected page in pages tool
        outline: isPagesToolActive && isCurrent ? '3px solid var(--color-accent)' : 'none',
        outlineOffset: isPagesToolActive && isCurrent ? '4px' : '0',
        transition: 'outline 150ms cubic-bezier(0.23,1,0.32,1)',
      }}
      onClick={() => {
        if (isPagesToolActive) {
          setCurrentPage(pageIndex)
        }
      }}
    >
      {/* Page selection badge in pages tool mode */}
      {isPagesToolActive && isCurrent && (
        <div style={{
          position: 'absolute', top: -28, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--color-accent)', color: 'white',
          fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20,
          whiteSpace: 'nowrap', zIndex: 50, pointerEvents: 'none',
          animation: 'toastEnter 0.2s cubic-bezier(0.23,1,0.32,1) both',
        }}>
          דף {pageIndex + 1} נבחר
        </div>
      )}
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
