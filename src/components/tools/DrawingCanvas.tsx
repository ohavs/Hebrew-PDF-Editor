import React, { useRef, useEffect, useCallback, useMemo } from 'react'
import { useAnnotationsStore, useUIStore } from '../../store'
import type { Point, DrawAnnotation } from '../../store/types'

interface Props {
  pageIndex: number
  /** Natural (zoom-1) page size — the coordinate space for stored points */
  width: number
  height: number
  zoom: number
}

// Backing-store supersampling so strokes stay crisp when the layer is scaled up
const RES = 2

export const DrawingCanvas: React.FC<Props> = ({ pageIndex, width, height, zoom }) => {
  const liveCanvasRef = useRef<HTMLCanvasElement>(null)
  const savedCanvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const pointsRef = useRef<Point[]>([])
  const { drawColor, drawWidth, drawOpacity, activeTool, authorName } = useUIStore()
  const { addAnnotation, annotations, pushHistory } = useAnnotationsStore()

  const isActive = activeTool === 'draw'

  const drawAnnotations = useMemo(
    () => annotations.filter(a => a.pageIndex === pageIndex && a.type === 'draw') as DrawAnnotation[],
    [annotations, pageIndex]
  )

  const drawPath = useCallback((ctx: CanvasRenderingContext2D, points: Point[], color: string, sw: number, opacity: number) => {
    if (points.length < 2) return
    ctx.save()
    ctx.scale(RES, RES)
    ctx.strokeStyle = color
    ctx.lineWidth = sw
    ctx.globalAlpha = opacity
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) {
      const mid = { x: (points[i-1].x + points[i].x) / 2, y: (points[i-1].y + points[i].y) / 2 }
      ctx.quadraticCurveTo(points[i-1].x, points[i-1].y, mid.x, mid.y)
    }
    ctx.stroke()
    ctx.restore()
  }, [])

  // Redraw saved canvas whenever annotations change
  useEffect(() => {
    const canvas = savedCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawAnnotations.forEach(ann => drawPath(ctx, ann.points, ann.color, ann.strokeWidth, ann.opacity))
  }, [drawAnnotations, width, height, drawPath])

  const getPos = useCallback((e: MouseEvent | TouchEvent): Point => {
    const rect = liveCanvasRef.current!.getBoundingClientRect()
    // getBoundingClientRect is post-transform → divide by zoom for natural coords
    if ('touches' in e) return { x: (e.touches[0].clientX - rect.left) / zoom, y: (e.touches[0].clientY - rect.top) / zoom }
    return { x: ((e as MouseEvent).clientX - rect.left) / zoom, y: ((e as MouseEvent).clientY - rect.top) / zoom }
  }, [zoom])

  const onEndRef = useRef<() => void>(() => {})

  const onStart = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isActive) return
    if ('touches' in e && e.touches.length !== 1) return
    e.preventDefault()
    isDrawingRef.current = true
    pushHistory()
    pointsRef.current = [getPos(e)]
  }, [isActive, pushHistory, getPos])

  const onMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDrawingRef.current || !isActive) return
    if ('touches' in e && e.touches.length !== 1) { onEndRef.current(); return }
    e.preventDefault()
    const live = liveCanvasRef.current
    const ctx = live?.getContext('2d')
    if (!ctx || !live) return
    pointsRef.current.push(getPos(e))
    ctx.clearRect(0, 0, live.width, live.height)
    drawPath(ctx, pointsRef.current, drawColor, drawWidth, drawOpacity)
  }, [isActive, drawColor, drawWidth, drawOpacity, drawPath, getPos])

  const onEnd = useCallback(() => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    const points = [...pointsRef.current]
    pointsRef.current = []

    if (points.length > 1) {
      // Draw on savedCanvas FIRST so there's no flash when liveCanvas clears
      const savedCtx = savedCanvasRef.current?.getContext('2d')
      if (savedCtx) {
        drawPath(savedCtx, points, drawColor, drawWidth, drawOpacity)
      }
      const live = liveCanvasRef.current
      live?.getContext('2d')?.clearRect(0, 0, live.width, live.height)
      const da: Omit<DrawAnnotation, 'id' | 'createdAt'> = {
        type: 'draw', pageIndex, points,
        color: drawColor, strokeWidth: drawWidth, opacity: drawOpacity, author: authorName
      }
      addAnnotation(da)
    } else {
      const live = liveCanvasRef.current
      live?.getContext('2d')?.clearRect(0, 0, live.width, live.height)
    }
  }, [addAnnotation, pageIndex, drawColor, drawWidth, drawOpacity, authorName, drawPath])

  useEffect(() => { onEndRef.current = onEnd }, [onEnd])

  useEffect(() => {
    const canvas = liveCanvasRef.current
    if (!canvas) return
    canvas.addEventListener('mousedown', onStart)
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseup', onEnd)
    canvas.addEventListener('mouseleave', onEnd)
    canvas.addEventListener('touchstart', onStart, { passive: false })
    canvas.addEventListener('touchmove', onMove, { passive: false })
    canvas.addEventListener('touchend', onEnd)
    canvas.addEventListener('touchcancel', onEnd)
    return () => {
      canvas.removeEventListener('mousedown', onStart)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseup', onEnd)
      canvas.removeEventListener('mouseleave', onEnd)
      canvas.removeEventListener('touchstart', onStart)
      canvas.removeEventListener('touchmove', onMove)
      canvas.removeEventListener('touchend', onEnd)
      canvas.removeEventListener('touchcancel', onEnd)
    }
  }, [onStart, onMove, onEnd])

  const canvasStyle: React.CSSProperties = {
    position: 'absolute', top: 0, left: 0,
    width, height,
  }

  return (
    <>
      <canvas
        ref={savedCanvasRef}
        width={width * RES} height={height * RES}
        style={{ ...canvasStyle, pointerEvents: 'none', zIndex: 14 }}
      />
      <canvas
        ref={liveCanvasRef}
        width={width * RES} height={height * RES}
        style={{
          ...canvasStyle,
          pointerEvents: isActive ? 'all' : 'none',
          cursor: isActive ? 'crosshair' : 'default',
          zIndex: 15,
        }}
      />
    </>
  )
}
