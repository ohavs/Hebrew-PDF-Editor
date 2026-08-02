import { usePDFStore } from '../store'

/** Gap between the two pages of a spread — matches the flex gap in PDFViewer. */
export const SPREAD_GAP = 16

/**
 * Zoom that makes the current page (or the current spread) fit the viewport.
 *
 * Two-page mode is the reason this is shared: fitting the width of a single
 * page leaves a spread twice as wide as the window, so "fit width" used to
 * hand back a document you had to scroll sideways through.
 */
export function computeFitZoom(kind: 'width' | 'page'): number | null {
  const container = document.querySelector('.pdf-scroll-container') as HTMLElement | null
  if (!container) return null

  const { pageInfos, currentPage, viewMode } = usePDFStore.getState()
  const info = pageInfos[currentPage] || pageInfos[0]
  if (!info?.width || !info?.height) return null

  // A rotated page is displayed with its axes swapped
  const rotated = ((info.rotation || 0) % 180 + 180) % 180 === 90
  const pageW = rotated ? info.height : info.width
  const pageH = rotated ? info.width : info.height

  const perSpread = viewMode === 'two-page' ? 2 : 1
  const availableW = container.clientWidth - 48 - (perSpread - 1) * SPREAD_GAP
  const widthZoom = availableW / (pageW * perSpread)
  if (kind === 'width') return clamp(widthZoom)

  // Fit page: the whole page must be visible, so take whichever axis binds
  const heightZoom = (container.clientHeight - 48) / pageH
  return clamp(Math.min(widthZoom, heightZoom))
}

function clamp(z: number) {
  return Math.max(0.1, Math.min(4, z))
}
