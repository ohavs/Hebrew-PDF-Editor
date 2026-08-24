import type { Rect } from '../store/types'

export interface Guide {
  /** Vertical guides are an x position; horizontal ones a y position. */
  axis: 'x' | 'y'
  at: number
}

export interface SnapResult {
  rect: Rect
  guides: Guide[]
}

/** Screen pixels of slack before a drag is pulled onto a line. */
export const SNAP_TOLERANCE = 7

const edgesX = (r: Rect) => [r.x, r.x + r.width / 2, r.x + r.width]
const edgesY = (r: Rect) => [r.y, r.y + r.height / 2, r.y + r.height]

/**
 * Pull a dragged rectangle onto the nearest alignment line.
 *
 * Candidates are the page's edges and centres plus the edges and centres of
 * every other object on the page. Each axis is decided independently — an
 * object can be centred horizontally while its top aligns with a neighbour —
 * and only the lines actually used are returned, so the guides drawn are the
 * ones the snap is based on rather than every line in range.
 */
export function computeSnap(
  moving: Rect,
  others: Rect[],
  page: { width: number; height: number },
  tolerance: number,
): SnapResult {
  const targetsX = [0, page.width / 2, page.width, ...others.flatMap(edgesX)]
  const targetsY = [0, page.height / 2, page.height, ...others.flatMap(edgesY)]

  const best = (positions: number[], targets: number[]) => {
    let delta = 0
    let at: number | null = null
    let closest = tolerance
    for (const pos of positions) {
      for (const t of targets) {
        const d = Math.abs(t - pos)
        if (d < closest) { closest = d; delta = t - pos; at = t }
      }
    }
    return { delta, at }
  }

  const x = best(edgesX(moving), targetsX)
  const y = best(edgesY(moving), targetsY)

  const guides: Guide[] = []
  if (x.at !== null) guides.push({ axis: 'x', at: x.at })
  if (y.at !== null) guides.push({ axis: 'y', at: y.at })

  return {
    rect: { ...moving, x: moving.x + x.delta, y: moving.y + y.delta },
    guides,
  }
}
