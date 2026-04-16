import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { usePDFStore, useUIStore } from '../../store'
import { usePDF } from '../../hooks/usePDF'

export const ThumbnailPanel: React.FC = () => {
  const { t } = useTranslation()
  const { pdfDoc, pageOrder, currentPage, setCurrentPage, reorderPages, pageInfos } = usePDFStore()
  const { addToast } = useUIStore()
  const { renderThumbnail } = usePDF()
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const thumbRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const renderedRef = useRef<Set<number>>(new Set())
  const observerRef = useRef<IntersectionObserver | null>(null)

  const renderThumb = useCallback(async (pageIdx: number) => {
    if (!pdfDoc || renderedRef.current.has(pageIdx)) return
    const canvas = thumbRefs.current.get(pageIdx)
    if (!canvas) return
    renderedRef.current.add(pageIdx)
    await renderThumbnail(pdfDoc, pageIdx, canvas, 140)
  }, [pdfDoc, renderThumbnail])

  // Set up intersection observer for lazy thumbnail rendering
  useEffect(() => {
    if (!pdfDoc) return
    renderedRef.current.clear()

    thumbRefs.current.clear()

    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const idx = parseInt((entry.target as HTMLElement).dataset.pageIdx || '0')
          renderThumb(idx)
        }
      })
    }, { threshold: 0.01 })

    // Observe all already-registered canvases (handles race with setThumbRef)
    thumbRefs.current.forEach((canvas) => {
      observerRef.current?.observe(canvas)
    })

    return () => observerRef.current?.disconnect()
  }, [pdfDoc, renderThumb])

  const setThumbRef = useCallback((pageIdx: number, canvas: HTMLCanvasElement | null) => {
    if (canvas) {
      thumbRefs.current.set(pageIdx, canvas)
      // Observe the canvas itself (it has data-page-idx); render immediately if already visible
      if (observerRef.current) {
        observerRef.current.observe(canvas)
      } else {
        // Observer not ready yet — render directly
        renderThumb(pageIdx)
      }
    }
  }, [renderThumb])

  // Drag and drop
  const handleDragStart = (idx: number) => setDragIdx(idx)
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setDragOverIdx(idx)
  }
  const handleDrop = (toIdx: number) => {
    if (dragIdx === null || dragIdx === toIdx) return
    reorderPages(dragIdx, toIdx)
    renderedRef.current.clear()
    thumbRefs.current.clear()
    setDragIdx(null)
    setDragOverIdx(null)
  }
  const handleDragEnd = () => { setDragIdx(null); setDragOverIdx(null) }

  if (!pdfDoc) return (
    <div style={{ padding: 16, color: 'var(--color-text-muted)', fontSize: 13, textAlign: 'center' }}>
      {t('viewer.noFile')}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border)', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>
        {t('viewer.thumbnails')} ({pageOrder.length})
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {pageOrder.map((pageIdx, orderIdx) => {
          const info = pageInfos[pageIdx]
          const rotation = info?.rotation || 0
          return (
            <div
              key={pageIdx}
              className={`thumb-item ${currentPage === pageIdx ? 'active' : ''} ${dragIdx === orderIdx ? 'opacity-50' : ''} ${dragOverIdx === orderIdx && dragIdx !== orderIdx ? 'border-green-400' : ''}`}
              data-page-idx={pageIdx}
              draggable
              onDragStart={() => handleDragStart(orderIdx)}
              onDragOver={(e) => handleDragOver(e, orderIdx)}
              onDrop={() => handleDrop(orderIdx)}
              onDragEnd={handleDragEnd}
              onClick={() => setCurrentPage(pageIdx)}
              style={{
                cursor: 'pointer',
                padding: '6px',
                borderRadius: 6,
                border: `2px solid ${currentPage === pageIdx ? 'var(--color-accent)' : dragOverIdx === orderIdx ? '#22c55e' : 'transparent'}`,
                marginBottom: 6,
                background: currentPage === pageIdx ? 'rgba(37,99,235,0.06)' : undefined,
                transition: 'border-color 0.15s',
                opacity: dragIdx === orderIdx ? 0.5 : 1
              }}
            >
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', background: 'white', borderRadius: 2, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.12)', transform: `rotate(${rotation}deg)` }}>
                <canvas
                  ref={canvas => setThumbRef(pageIdx, canvas)}
                  data-page-idx={pageIdx}
                  style={{ display: 'block', maxWidth: '100%' }}
                />
              </div>
              <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                {orderIdx + 1}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
