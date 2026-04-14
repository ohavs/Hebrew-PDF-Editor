import React from 'react'
import { useTranslation } from 'react-i18next'
import { useUIStore } from '../../store'
import { ThumbnailPanel } from './ThumbnailPanel'
import { AnnotationsPanel } from './AnnotationsPanel'
import type { SidePanel } from '../../store/types'

const TABS: Array<{ id: SidePanel; label: string }> = [
  { id: 'thumbnails', label: 'viewer.thumbnails' },
  { id: 'annotations', label: 'viewer.annotations' },
]

export const LeftPanel: React.FC = () => {
  const { t } = useTranslation()
  const { sidePanel, setSidePanel } = useUIStore()

  const activeIdx = TABS.findIndex(tab => tab.id === sidePanel)
  const indicatorLeft = activeIdx >= 0 ? `${(activeIdx / TABS.length) * 100}%` : '0%'

  return (
    <div
      className="no-print desktop-only"
      style={{
        width: 200,
        background: 'var(--color-surface)',
        borderInlineEnd: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden'
      }}
    >
      {/* Tab bar with sliding indicator */}
      <div style={{ position: 'relative', display: 'flex', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        {/* Sliding indicator */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: indicatorLeft,
          width: `${100 / TABS.length}%`,
          height: 2,
          background: 'var(--color-accent)',
          borderRadius: '2px 2px 0 0',
          transition: 'left 220ms cubic-bezier(0.23,1,0.32,1)',
          pointerEvents: 'none',
        }} />
        {TABS.map((tab, i) => (
          <button
            key={tab.id}
            onClick={() => setSidePanel(tab.id)}
            style={{
              flex: 1,
              padding: '9px 4px',
              fontSize: 11,
              fontWeight: 600,
              background: 'transparent',
              border: 'none',
              borderBottom: '2px solid transparent',
              color: sidePanel === tab.id ? 'var(--color-accent)' : 'var(--color-text-muted)',
              cursor: 'pointer',
              transition: 'color 180ms ease-out',
              fontFamily: 'inherit',
              letterSpacing: '0.01em',
            }}
          >
            {t(tab.label)}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {sidePanel === 'thumbnails' && <ThumbnailPanel />}
        {sidePanel === 'annotations' && <AnnotationsPanel />}
      </div>
    </div>
  )
}
