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
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setSidePanel(tab.id)}
            style={{
              flex: 1,
              padding: '8px 4px',
              fontSize: 11,
              fontWeight: 500,
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${sidePanel === tab.id ? 'var(--color-accent)' : 'transparent'}`,
              color: sidePanel === tab.id ? 'var(--color-accent)' : 'var(--color-text-muted)',
              cursor: 'pointer',
              transition: 'all 0.15s',
              fontFamily: 'inherit'
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
