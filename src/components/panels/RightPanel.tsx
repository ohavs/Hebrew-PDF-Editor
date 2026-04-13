import React from 'react'
import { useTranslation } from 'react-i18next'
import { useUIStore } from '../../store'
import { PropertiesPanel } from './PropertiesPanel'

export const RightPanel: React.FC = () => {
  const { rightPanelOpen, setRightPanelOpen } = useUIStore()
  const { t } = useTranslation()

  return (
    <div
      className="no-print desktop-only"
      style={{
        width: rightPanelOpen ? 280 : 0,
        overflow: 'hidden',
        transition: 'width 0.2s ease',
        flexShrink: 0,
        borderInlineStart: rightPanelOpen ? '1px solid var(--color-border)' : 'none',
        background: 'var(--color-surface)',
        position: 'relative'
      }}
    >
      {rightPanelOpen && (
        <div style={{ width: 280, height: '100%', overflowY: 'auto' }}>
          <PropertiesPanel />
        </div>
      )}

      {/* Toggle button */}
      <button
        className="btn-icon"
        onClick={() => setRightPanelOpen(!rightPanelOpen)}
        title={rightPanelOpen ? 'סגור פנל' : 'פתח פנל'}
        style={{
          position: 'absolute',
          top: '50%',
          insetInlineStart: rightPanelOpen ? -14 : -14,
          transform: 'translateY(-50%)',
          width: 14,
          height: 40,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderInlineEnd: 'none',
          borderRadius: '4px 0 0 4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          fontSize: 10,
          color: 'var(--color-text-muted)',
          cursor: 'pointer',
          padding: 0
        }}
      >
        {rightPanelOpen ? '›' : '‹'}
      </button>
    </div>
  )
}
