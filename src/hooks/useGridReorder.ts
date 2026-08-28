import { useCallback, useRef, useState } from 'react'
import type React from 'react'

export interface GridReorder {
  /** Attach to a drag handle: onPointerDown={e => start(e, index)} */
  start: (e: React.PointerEvent, index: number) => void
  /** Index being dragged, or null */
  dragIdx: number | null
  /** Index the dragged card would land on, or null */
  targetIdx: number | null
  /** Pixel offset of the dragged card from its origin */
  delta: { x: number; y: number }
  /** Where card `i` should sit while a drag is in progress */
  shiftFor: (i: number) => { x: number; y: number }
  /** Ref for the grid container (cells must carry data-grid-cell) */
  gridRef: React.RefObject<HTMLDivElement | null>
}

/**
 * Pointer-based reordering for a CSS grid. Works with mouse, touch and pen:
 * the drop target is the cell whose centre is nearest the pointer, and the
 * other cells slide to the positions they would occupy after the move.
 *
 * Cells must be marked with `data-grid-cell`, and only the drag handle should
 * set `touch-action: none` so the grid keeps scrolling normally.
 */
export function useGridReorder(onReorder: (from: number, to: number) => void): GridReorder {
  const gridRef = useRef<HTMLDivElement | null>(null)
  const cellRects = useRef<DOMRect[]>([])
  const targetRef = useRef<number | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [targetIdx, setTargetIdx] = useState<number | null>(null)
  const [delta, setDelta] = useState({ x: 0, y: 0 })

  const start = useCallback((e: React.PointerEvent, index: number) => {
    e.preventDefault()
    e.stopPropagation()

    const nodes = gridRef.current?.querySelectorAll('[data-grid-cell]')
    cellRects.current = Array.from(nodes || []).map(n => n.getBoundingClientRect())

    const el = e.currentTarget as HTMLElement
    const pid = e.pointerId
    const startX = e.clientX, startY = e.clientY
    try { el.setPointerCapture(pid) } catch { /* detached */ }

    setDragIdx(index)
    setDelta({ x: 0, y: 0 })
    setTargetIdx(index)
    targetRef.current = index

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return
      ev.preventDefault()
      setDelta({ x: ev.clientX - startX, y: ev.clientY - startY })
      let best = index, bestDist = Infinity
      cellRects.current.forEach((r, i) => {
        const d = Math.hypot(ev.clientX - (r.left + r.width / 2), ev.clientY - (r.top + r.height / 2))
        if (d < bestDist) { bestDist = d; best = i }
      })
      if (best !== targetRef.current) {
        targetRef.current = best
        setTargetIdx(best)
      }
    }
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      const to = targetRef.current
      if (to !== null && to !== index) onReorder(index, to)
      setDragIdx(null); setTargetIdx(null); targetRef.current = null
      setDelta({ x: 0, y: 0 })
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
  }, [onReorder])

  const shiftFor = useCallback((i: number) => {
    if (dragIdx === null || targetIdx === null || i === dragIdx) return { x: 0, y: 0 }
    let newPos = i
    if (dragIdx < targetIdx && i > dragIdx && i <= targetIdx) newPos = i - 1
    else if (dragIdx > targetIdx && i >= targetIdx && i < dragIdx) newPos = i + 1
    if (newPos === i) return { x: 0, y: 0 }
    const from = cellRects.current[i], to = cellRects.current[newPos]
    if (!from || !to) return { x: 0, y: 0 }
    return { x: to.left - from.left, y: to.top - from.top }
  }, [dragIdx, targetIdx])

  return { start, dragIdx, targetIdx, delta, shiftFor, gridRef }
}

/**
 * Move a set of items so they land as one block at `to`, keeping their
 * relative order. Dragging a multi-selection has to behave this way, or the
 * pages arrive scattered around the drop point.
 */
export function moveMany<T>(list: T[], moving: Set<T>, to: number): T[] {
  const picked = list.filter(x => moving.has(x))
  if (!picked.length) return list
  const rest = list.filter(x => !moving.has(x))
  // `to` indexes the original list; translate it to the gap in what remains
  const removedBefore = list.slice(0, to).filter(x => moving.has(x)).length
  const at = Math.max(0, Math.min(rest.length, to - removedBefore))
  return [...rest.slice(0, at), ...picked, ...rest.slice(at)]
}

/** Move an item between positions, returning a new array. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}
