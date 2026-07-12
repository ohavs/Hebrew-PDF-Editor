import React, { useState } from 'react'
import { useUIStore, usePDFStore } from '../../store'
import type { ToolType } from '../../store/types'
import { MobileToolsSheet } from './MobileToolsSheet'
import { MobilePagesSheet } from './MobilePagesSheet'

const EASE = 'cubic-bezier(0.23,1,0.32,1)'

const PRIMARY_TOOLS: Array<{ id: ToolType | 'pages'; label: string; icon: React.ReactNode }> = [
  { id: 'select', label: 'בחר', icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3l7 19 3-7 7-3L3 3z"/></svg> },
  { id: 'text', label: 'טקסט', icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7V4h16v3M9 20h6M12 4v16"/></svg> },
  { id: 'highlight', label: 'סמן', icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536-8.5 8.5H7v-3.268l8.232-8.232z"/><rect x="3" y="19" width="18" height="2" rx="1" fill="currentColor" opacity="0.3"/></svg> },
  { id: 'draw', label: 'ציור', icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg> },
  { id: 'pages', label: 'דפים', icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="4" y="2" width="10" height="14" rx="1"/><rect x="7" y="6" width="10" height="14" rx="1" fill="var(--color-surface)" stroke="currentColor"/></svg> },
]

export const MobileBottomNav: React.FC = () => {
  const { activeTool, setTool } = useUIStore()
  const { pdfDoc } = usePDFStore()
  const [showTools, setShowTools] = useState(false)
  const [showPages, setShowPages] = useState(false)

  const handle = (id: ToolType | 'pages' | 'more') => {
    if (id === 'pages') { setShowPages(true); return }
    if (id === 'more') { setShowTools(true); return }
    setTool(id as ToolType)
  }

  return (
    <>
      <div
        className="mobile-only no-print"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 400,
          background: 'var(--color-surface)',
          borderTop: '1px solid var(--color-border)',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -4px 30px rgba(0,0,0,0.1)',
          paddingBottom: 'env(safe-area-inset-bottom, 8px)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-around',
          padding: '8px 8px',
          gap: 4,
        }}>
          {PRIMARY_TOOLS.map(tool => {
            const isActive = tool.id === 'pages'
              ? showPages
              : activeTool === tool.id
            const isDisabled = !pdfDoc && tool.id !== 'select'
            return (
              <button
                key={tool.id}
                disabled={isDisabled}
                onClick={() => !isDisabled && handle(tool.id)}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 3, padding: '8px 4px',
                  border: 'none', borderRadius: 14, cursor: isDisabled ? 'not-allowed' : 'pointer',
                  background: isActive ? '#d1ffca' : 'transparent',
                  color: isActive ? '#000' : isDisabled ? 'var(--color-border)' : 'var(--color-graphite)',
                  minHeight: 56, fontFamily: 'inherit',
                  transition: `background 160ms ${EASE}, color 160ms ${EASE}, transform 120ms ${EASE}`,
                  userSelect: 'none', WebkitTapHighlightColor: 'transparent',
                }}
                onMouseDown={e => { if (!isDisabled) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.9)' }}
                onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
                onTouchStart={e => { if (!isDisabled) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.9)' }}
                onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
              >
                {tool.icon}
                <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500, lineHeight: 1 }}>{tool.label}</span>
              </button>
            )
          })}

          {/* More tools button */}
          <button
            onClick={() => setShowTools(true)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 3, padding: '8px 4px',
              border: 'none', borderRadius: 14, cursor: 'pointer',
              background: 'transparent',
              color: 'var(--color-graphite)',
              minHeight: 56, fontFamily: 'inherit',
              transition: `background 160ms ${EASE}, transform 120ms ${EASE}`,
              userSelect: 'none', WebkitTapHighlightColor: 'transparent',
            }}
            onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.9)' }}
            onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
            onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.9)' }}
            onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
          >
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none"/>
              <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
              <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none"/>
            </svg>
            <span style={{ fontSize: 10, fontWeight: 500, lineHeight: 1 }}>עוד</span>
          </button>
        </div>
      </div>

      {/* All tools sheet */}
      <MobileToolsSheet open={showTools} onClose={() => setShowTools(false)} />

      {/* Pages sheet */}
      <MobilePagesSheet open={showPages} onClose={() => setShowPages(false)} />
    </>
  )
}
