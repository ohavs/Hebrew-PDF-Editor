import React from 'react'
import { useUIStore } from '../../store'

interface Props {
  pageIndex: number
  naturalWidth: number
  naturalHeight: number
  zoom: number
}

/**
 * The alignment lines shown while an object is being dragged. Drawn across
 * the whole page so it is obvious what the object lined up with, and never
 * interactive — they exist for the duration of a gesture.
 */
export const GuidesLayer: React.FC<Props> = ({ pageIndex, naturalWidth, naturalHeight, zoom }) => {
  const guides = useUIStore(s => s.alignGuides)
  const guidesPage = useUIStore(s => s.alignGuidesPage)

  if (guidesPage !== pageIndex || !guides.length) return null

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0,
      width: naturalWidth * zoom, height: naturalHeight * zoom,
      pointerEvents: 'none', zIndex: 40,
    }}>
      {guides.map((g, i) => (
        <div
          key={i}
          data-align-guide={g.axis}
          style={g.axis === 'x'
            ? { position: 'absolute', left: g.at * zoom, top: 0, width: 1, height: '100%', background: '#ec4899' }
            : { position: 'absolute', top: g.at * zoom, left: 0, height: 1, width: '100%', background: '#ec4899' }}
        />
      ))}
    </div>
  )
}
