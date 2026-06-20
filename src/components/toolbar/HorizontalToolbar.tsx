import React from 'react'
import { useUIStore, usePDFStore } from '../../store'
import type { ToolType } from '../../store/types'

const EASE = 'cubic-bezier(0.23,1,0.32,1)'

interface ToolDef { id: ToolType; label: string; icon: React.ReactNode }

const GROUPS: ToolDef[][] = [
  [
    { id: 'select', label: 'בחר', icon: <SelectIcon /> },
    { id: 'text', label: 'טקסט', icon: <TextIcon /> },
    { id: 'highlight', label: 'הדגשה', icon: <HighlightIcon /> },
  ],
  [
    { id: 'draw', label: 'ציור', icon: <DrawIcon /> },
    { id: 'shapes', label: 'צורות', icon: <ShapesIcon /> },
    { id: 'stamp', label: 'חותמת', icon: <StampIcon /> },
  ],
  [
    { id: 'signature', label: 'חתימה', icon: <SigIcon /> },
    { id: 'pages', label: 'דפים', icon: <PagesIcon /> },
  ],
]

export const HorizontalToolbar: React.FC = () => {
  const { activeTool, setTool, setSidePanel } = useUIStore()
  const { pdfDoc } = usePDFStore()

  const handleTool = (id: ToolType) => {
    setTool(id)
    if (id === 'pages') setSidePanel('pages')
  }

  return (
    <div
      className="no-print"
      style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        height: 48,
        gap: 2,
        flexShrink: 0,
        overflowX: 'auto',
        overflowY: 'hidden',
        zIndex: 150,
      }}
    >
      {GROUPS.map((group, gi) => (
        <React.Fragment key={gi}>
          {gi > 0 && (
            <div style={{ width: 1, height: 28, background: 'var(--color-border)', margin: '0 4px', flexShrink: 0 }} />
          )}
          {group.map(tool => {
            const active = activeTool === tool.id
            const disabled = !pdfDoc && tool.id !== 'select'
            return (
              <button
                key={tool.id}
                title={tool.label}
                disabled={disabled}
                onClick={() => !disabled && handleTool(tool.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  padding: '4px 10px',
                  border: 'none',
                  borderRadius: 8,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  background: active ? 'var(--color-mint)' : 'transparent',
                  color: active ? 'var(--color-ink-black)' : disabled ? 'var(--color-border)' : 'var(--color-graphite)',
                  minWidth: 54,
                  height: 40,
                  flexShrink: 0,
                  outline: 'none',
                  fontFamily: 'inherit',
                  transition: `background 140ms ${EASE}, color 140ms ${EASE}, transform 150ms ${EASE}`,
                  position: 'relative',
                }}
                onMouseEnter={e => {
                  if (!active && !disabled) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-mist)'
                }}
                onMouseLeave={e => {
                  if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                }}
                onMouseDown={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.92)' }}
                onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
              >
                {/* Active indicator dot */}
                {active && (
                  <span style={{
                    position: 'absolute',
                    bottom: 2,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: 'var(--color-ink-black)',
                  }} />
                )}
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {tool.icon}
                </span>
                <span style={{
                  fontSize: 10,
                  fontWeight: active ? 600 : 500,
                  lineHeight: 1,
                  letterSpacing: '0.01em',
                }}>
                  {tool.label}
                </span>
              </button>
            )
          })}
        </React.Fragment>
      ))}
    </div>
  )
}

// Mobile bottom toolbar (kept for mobile)
export const BottomToolbar: React.FC = () => {
  const { activeTool, setTool } = useUIStore()
  const { pdfDoc } = usePDFStore()
  const mobileDefs: ToolDef[] = [
    { id: 'select', label: 'בחר', icon: <SelectIcon /> },
    { id: 'text', label: 'טקסט', icon: <TextIcon /> },
    { id: 'highlight', label: 'הדגשה', icon: <HighlightIcon /> },
    { id: 'draw', label: 'ציור', icon: <DrawIcon /> },
    { id: 'shapes', label: 'צורות', icon: <ShapesIcon /> },
    { id: 'signature', label: 'חתימה', icon: <SigIcon /> },
  ]
  return (
    <div className="no-print mobile-only" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, height: 60,
      background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      padding: '0 4px', zIndex: 300, boxShadow: '0 -2px 10px rgba(0,0,0,0.08)'
    }}>
      {mobileDefs.map(tool => {
        const active = activeTool === tool.id
        const disabled = !pdfDoc && tool.id !== 'select'
        return (
          <button key={tool.id} disabled={disabled} onClick={() => setTool(tool.id)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              padding: '4px 8px', border: 'none', borderRadius: 8,
              background: active ? 'var(--color-mint)' : 'transparent',
              color: active ? 'var(--color-ink-black)' : 'var(--color-text-muted)',
              cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}>
            {tool.icon}
            <span style={{ fontSize: 9, fontWeight: 500 }}>{tool.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// Icons
function SelectIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3l7 19 3-7 7-3L3 3z"/></svg>
}
function TextIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>
}
function HighlightIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536-8.5 8.5H7v-3.268l8.232-8.232zM3 21h18"/><rect x="3" y="15" width="18" height="3" rx="1" fill="currentColor" opacity="0.2"/></svg>
}
function DrawIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
}
function ShapesIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><circle cx="17" cy="7" r="4"/><path strokeLinecap="round" strokeLinejoin="round" d="M7 17l5 5 5-5"/></svg>
}
function StampIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>
}
function SigIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/><path strokeLinecap="round" d="M3 21h18" strokeWidth="1.5"/></svg>
}
function PagesIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H7m12 0a2 2 0 012 2v6a2 2 0 01-2 2H7a2 2 0 01-2-2v-6a2 2 0 012-2m12 0V9a2 2 0 00-2-2M7 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M9 7h6"/></svg>
}
