import React from 'react'
import { useUIStore } from '../../store'
import { PropertiesPanel } from './PropertiesPanel'
import { ObjectActions } from './ObjectActions'

export const RightPanel: React.FC = () => {
  const { rightPanelOpen, setRightPanelOpen } = useUIStore()

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
          <ObjectActions />
          <PropertiesPanel />
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setRightPanelOpen(!rightPanelOpen)}
        title={rightPanelOpen ? 'סגור פנל' : 'פתח פנל'}
        style={{
          position: 'absolute',
          top: '50%',
          insetInlineStart: -24,
          transform: 'translateY(-50%)',
          width: 24,
          height: 52,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderInlineEnd: 'none',
          borderRadius: '8px 0 0 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          color: 'var(--color-text-muted)',
          cursor: 'pointer',
          padding: 0,
          outline: 'none',
          transition: 'color 150ms ease-out, background 150ms ease-out',
          boxShadow: '-2px 0 8px rgba(0,0,0,0.06)',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-2)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface)' }}
        onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-50%) scale(0.95)' }}
        onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-50%)' }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          {rightPanelOpen
            ? <path d="M4 2l4 4-4 4"/>
            : <path d="M8 2L4 6l4 4"/>
          }
        </svg>
      </button>
    </div>
  )
}
