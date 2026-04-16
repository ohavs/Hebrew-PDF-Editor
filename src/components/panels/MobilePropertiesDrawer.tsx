import React, { useState, useEffect } from 'react'
import { useUIStore } from '../../store'
import { PropertiesPanel } from './PropertiesPanel'

export const MobilePropertiesDrawer: React.FC = () => {
  const { activeTool } = useUIStore()
  const [isOpen, setIsOpen] = useState(false)

  // Auto-open when user picks a non-select tool
  useEffect(() => {
    if (activeTool !== 'select') setIsOpen(true)
    else setIsOpen(false)
  }, [activeTool])

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="mobile-only"
          style={{ position: 'fixed', inset: 0, zIndex: 399, background: 'rgba(0,0,0,0.18)' }}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer */}
      <div className={`mobile-props-drawer mobile-only${isOpen ? '' : ' hidden'}`}>
        <div className="mobile-props-handle" onClick={() => setIsOpen(false)} />
        <PropertiesPanel />
      </div>

      {/* Floating button when drawer is closed and a tool is active */}
      {!isOpen && activeTool !== 'select' && (
        <button
          className="mobile-only"
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: 16,
            insetInlineEnd: 16,
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'var(--color-accent)',
            color: 'white',
            border: 'none',
            boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 350,
            fontSize: 18,
            transition: 'transform 150ms cubic-bezier(0.23,1,0.32,1)',
          }}
          onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.9)' }}
          onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
          </svg>
        </button>
      )}
    </>
  )
}
