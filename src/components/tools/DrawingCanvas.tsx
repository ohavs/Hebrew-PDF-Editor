import React, { useRef, useEffect, useCallback } from 'react'
import { useAnnotationsStore, useUIStore } from '../../store'
import type { Point, DrawAnnotation } from '../../store/types'

interface Props {
  pageIndex: number
  width: number
  height: number
}

export const DrawingCanvas: React.FC<Props> = ({ pageIndex, width, height }) => {
  const liveCanvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawingRef = useRef(false)
  const pointsRef = useRef<Point[]>([])
  const { drawColor, drawWidth, drawOpacity, activeTool, authorName } = useUIStore()
  const { addAnnotation, annotations, pushHistory, deleteAnnotation } = useAnnotationsStore()

  const isActive = activeTool === 'draw'
  const drawAnnotations = annotations.filter(a => a.pageIndex === pageIndex && a.type === 'draw') as DrawAnnotation[]

  const getPos = (e: MouseEvent | TouchEvent): Point => {
    const rect = liveCanvasRef.current!.getBoundingClientRect()
    if ('touches' in e) return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    return { x: (e as MouseEvent).clientX - rect.left, y: (e as MouseEvent).clientY - rect.top }
  }

  const drawPath = (ctx: CanvasRenderingContext2D, points: Point[], color: string, sw: number, opacity: number) => {
    if (points.length < 2) return
    ctx.save()
    ctx.strokeStyle = color; ctx.lineWidth = sw; ctx.globalAlpha = opacity
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) {
      const mid = { x: (points[i-1].x + points[i].x) / 2, y: (points[i-1].y + points[i].y) / 2 }
      ctx.quadraticCurveTo(points[i-1].x, points[i-1].y, mid.x, mid.y)
    }
    ctx.stroke(); ctx.restore()
  }

  // Render all saved paths on a persistent canvas
  const savedCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = savedCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, width, height)
    drawAnnotations.forEach(ann => drawPath(ctx, ann.points, ann.color, ann.strokeWidth, ann.opacity))
  }, [drawAnnotations, width, height])

  const onStart = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isActive) return
    e.preventDefault()
    isDrawingRef.current = true
    pushHistory()
    pointsRef.current = [getPos(e)]
  }, [isActive, pushHistory])

  const onMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDrawingRef.current || !isActive) return
    e.preventDefault()
    const ctx = liveCanvasRef.current?.getContext('2d')
    if (!ctx) return
    pointsRef.current.push(getPos(e))
    ctx.clearRect(0, 0, width, height)
    drawPath(ctx, pointsRef.current, drawColor, drawWidth, drawOpacity)
  }, [isActive, drawColor, drawWidth, drawOpacity, width, height])

  const onEnd = useCallback(() => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    const points = [...pointsRef.current]
    pointsRef.current = []
    if (points.length > 1) {
      const da: Omit<DrawAnnotation, 'id' | 'createdAt'> = {
        type: 'draw', pageIndex, points,
        color: drawColor, strokeWidth: drawWidth, opacity: drawOpacity, author: authorName
      }
      addAnnotation(da)
    }
    liveCanvasRef.current?.getContext('2d')?.clearRect(0, 0, width, height)
  }, [addAnnotation, pageIndex, drawColor, drawWidth, drawOpacity, width, height, authorName])

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

  return (
    <>
      {/* Persistent saved paths */}
      <canvas
        ref={savedCanvasRef}
        width={width} height={height}
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 14 }}
      />
      {/* Live drawing canvas — only interactive when draw tool active */}
      <canvas
        ref={liveCanvasRef}
        width={width} height={height}
        style={{
          position: 'absolute', top: 0, left: 0,
          pointerEvents: isActive ? 'all' : 'none',
          cursor: isActive ? 'crosshair' : 'default',
          zIndex: 15
        }}
      />
    </>
  )
}
