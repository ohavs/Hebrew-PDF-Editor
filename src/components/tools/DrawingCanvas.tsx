import React, { useRef, useEffect, useCallback } from 'react'
import { useAnnotationsStore, useUIStore } from '../../store'
import type { Point, DrawAnnotation } from '../../store/types'

interface Props {
  pageIndex: number
  width: number
  height: number
}

export const DrawingCanvas: React.FC<Props> = ({ pageIndex, width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const pointsRef = useRef<Point[]>([])
  const { drawColor, drawWidth, drawOpacity, activeTool, authorName } = useUIStore()
  const { addAnnotation, annotations, pushHistory } = useAnnotationsStore()

  // Only active when draw tool is selected
  const isActive = activeTool === 'draw'

  const getPos = (e: MouseEvent | TouchEvent): Point => {
    const rect = canvasRef.current!.getBoundingClientRect()
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    }
    return { x: (e as MouseEvent).clientX - rect.left, y: (e as MouseEvent).clientY - rect.top }
  }

  const drawLine = useCallback((ctx: CanvasRenderingContext2D, points: Point[]) => {
    if (points.length < 2) return
    ctx.clearRect(0, 0, width, height)
    ctx.strokeStyle = drawColor
    ctx.lineWidth = drawWidth
    ctx.globalAlpha = drawOpacity
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) {
      const mid = { x: (points[i-1].x + points[i].x) / 2, y: (points[i-1].y + points[i].y) / 2 }
      ctx.quadraticCurveTo(points[i-1].x, points[i-1].y, mid.x, mid.y)
    }
    ctx.stroke()
  }, [drawColor, drawWidth, drawOpacity, width, height])

  const onStart = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isActive) return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    isDrawingRef.current = true
    pushHistory()
    pointsRef.current = [getPos(e)]
  }, [isActive, pushHistory])

  const onMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDrawingRef.current || !isActive) return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e)
    pointsRef.current.push(pos)
    drawLine(ctx, pointsRef.current)
  }, [isActive, drawLine])

  const onEnd = useCallback(() => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    const points = [...pointsRef.current]
    pointsRef.current = []

    if (points.length > 1) {
      const da: Omit<DrawAnnotation, 'id' | 'createdAt'> = {
        type: 'draw',
        pageIndex,
        points,
        color: drawColor,
        strokeWidth: drawWidth,
        opacity: drawOpacity,
        author: authorName
      }
      addAnnotation(da)
    }

    // Clear canvas (annotation layer will re-render from store)
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, width, height)
  }, [addAnnotation, pageIndex, drawColor, drawWidth, drawOpacity, width, height, authorName])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('mousedown', onStart)
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseup', onEnd)
    canvas.addEventListener('mouseleave', onEnd)
    canvas.addEventListener('touchstart', onStart, { passive: false })
    canvas.addEventListener('touchmove', onMove, { passive: false })
    canvas.addEventListener('touchend', onEnd)
    return () => {
      canvas.removeEventListener('mousedown', onStart)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseup', onEnd)
      canvas.removeEventListener('mouseleave', onEnd)
      canvas.removeEventListener('touchstart', onStart)
      canvas.removeEventListener('touchmove', onMove)
      canvas.removeEventListener('touchend', onEnd)
    }
  }, [onStart, onMove, onEnd])

  // Render all draw annotations for this page on a separate canvas
  const drawAnnotations = annotations.filter(a => a.pageIndex === pageIndex && a.type === 'draw')

  return (
    <>
      {/* Render saved draw annotations */}
      {drawAnnotations.map(ann => {
        if (ann.type !== 'draw') return null
        return (
          <DrawPath
            key={ann.id}
            id={ann.id}
            points={ann.points}
            color={ann.color}
            width={ann.strokeWidth}
            opacity={ann.opacity}
            canvasWidth={width}
            canvasHeight={height}
          />
        )
      })}
      {/* Live drawing canvas */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          position: 'absolute', top: 0, left: 0,
          pointerEvents: isActive ? 'all' : 'none',
          cursor: isActive ? 'crosshair' : 'default',
          zIndex: 20
        }}
      />
    </>
  )
}

// Renders a single completed draw path
const DrawPath: React.FC<{ id: string; points: Point[]; color: string; width: number; opacity: number; canvasWidth: number; canvasHeight: number }> =
  ({ id, points, color, width, opacity, canvasWidth, canvasHeight }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { activeTool } = useUIStore()
  const { deleteAnnotation } = useAnnotationsStore()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || points.length < 2) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.globalAlpha = opacity
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) {
      const mid = { x: (points[i-1].x + points[i].x)/2, y: (points[i-1].y + points[i].y)/2 }
      ctx.quadraticCurveTo(points[i-1].x, points[i-1].y, mid.x, mid.y)
    }
    ctx.stroke()
  }, [points, color, width, opacity, canvasWidth, canvasHeight])

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: activeTool === 'eraser' ? 'all' : 'none', cursor: activeTool === 'eraser' ? 'cell' : 'default', zIndex: 15 }}
      onClick={() => { if (activeTool === 'eraser') deleteAnnotation(id) }}
    />
  )
}
