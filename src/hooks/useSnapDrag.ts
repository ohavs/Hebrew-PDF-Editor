import { useCallback } from 'react'
import { usePDFStore, useAnnotationsStore, useUIStore } from '../store'
import { computeSnap, SNAP_TOLERANCE, type Guide } from '../utils/snapping'
import type { Rect } from '../store/types'

/** The bounding rect of any object that has one, in natural page units. */
function rectOf(a: any): Rect | null {
  if (a?.rect) return a.rect
  if (a?.position) return { x: a.position.x, y: a.position.y, width: 0, height: 0 }
  return null
}

/**
 * Snapping for object drags: pulls the moving rectangle onto the page's edges
 * and centres, and onto the edges and centres of its neighbours, publishing
 * the lines it used so they can be drawn. Alt drags free.
 */
export function useSnapDrag() {
  const snapRect = useCallback((
    id: string,
    pageIndex: number,
    proposed: Rect,
    zoom: number,
    disabled: boolean,
  ): Rect => {
    const { setAlignGuides } = useUIStore.getState()
    if (disabled) {
      setAlignGuides([], pageIndex)
      return proposed
    }

    const { pageInfos } = usePDFStore.getState()
    const info = pageInfos[pageIndex]
    const page = { width: info?.width || 595, height: info?.height || 842 }

    const others = useAnnotationsStore.getState().annotations
      .filter(a => a.pageIndex === pageIndex && a.id !== id)
      .map(rectOf)
      .filter((r): r is Rect => !!r && r.width > 0 && r.height > 0)

    // The tolerance is in screen pixels, so it shrinks as the page is zoomed in
    const { rect, guides } = computeSnap(proposed, others, page, SNAP_TOLERANCE / zoom)
    setAlignGuides(guides, pageIndex)
    return rect
  }, [])

  const clearGuides = useCallback(() => {
    useUIStore.getState().setAlignGuides([], -1)
  }, [])

  return { snapRect, clearGuides }
}

export type { Guide }
