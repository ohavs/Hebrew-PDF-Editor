import type React from 'react'

export interface PointerDragOpts {
  /** Deltas are in screen px — divide by zoom yourself if needed. */
  onMove: (dx: number, dy: number, ev: PointerEvent) => void
  onEnd?: (moved: boolean) => void
}

/**
 * Unified drag for mouse + touch + pen via Pointer Events.
 * Uses pointer capture so the gesture continues even when the finger
 * leaves the element. Call from an onPointerDown handler.
 */
export function startPointerDrag(e: React.PointerEvent, opts: PointerDragOpts) {
  const el = e.currentTarget as HTMLElement
  const pointerId = e.pointerId
  const startX = e.clientX
  const startY = e.clientY
  let moved = false

  try { el.setPointerCapture(pointerId) } catch { /* detached */ }

  const onMove = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return
    const dx = ev.clientX - startX
    const dy = ev.clientY - startY
    if (Math.abs(dx) + Math.abs(dy) > 3) moved = true
    opts.onMove(dx, dy, ev)
    ev.preventDefault()
  }
  const onUp = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return
    el.removeEventListener('pointermove', onMove)
    el.removeEventListener('pointerup', onUp)
    el.removeEventListener('pointercancel', onUp)
    try { el.releasePointerCapture(pointerId) } catch { /* already released */ }
    opts.onEnd?.(moved)
  }

  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerup', onUp)
  el.addEventListener('pointercancel', onUp)
}
