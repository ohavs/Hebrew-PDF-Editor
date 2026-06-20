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
    { id: 'underline', label: 'קו תחתון', icon: <UnderlineIcon /> },
    { id: 'strikethrough', label: 'קו חוצה', icon: <StrikethroughIcon /> },
  ],
  [
    { id: 'draw', label: 'ציור', icon: <DrawIcon /> },
    { id: 'eraser', label: 'מחק', icon: <EraserIcon /> },
    { id: 'shapes', label: 'צורות', icon: <ShapesIcon /> },
    { id: 'redact', label: 'כיסוי', icon: <RedactIcon /> },
    { id: 'stamp', label: 'חותמת', icon: <StampIcon /> },
  ],
  [
    { id: 'signature', label: 'חתימה', icon: <SigIcon /> },
    { id: 'comment', label: 'הערה', icon: <CommentIcon /> },
    { id: 'toolbox', label: 'כלי PDF', icon: <ToolboxIcon /> },
  ],
]

export const HorizontalToolbar: React.FC = () => {
  const { activeTool, setTool, setToolboxOpen, toolboxOpen } = useUIStore()
  const { pdfDoc } = usePDFStore()

  const handleTool = (id: ToolType) => {
    if (id === 'toolbox') {
      setToolboxOpen(!toolboxOpen)
      return
    }
    setTool(id)
  }

  return (
    <div
      className="no-print desktop-only"
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
            const active = tool.id === 'toolbox' ? toolboxOpen : activeTool === tool.id
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

// Mobile bottom toolbar — replaced by MobileBottomNav
export const BottomToolbar: React.FC = () => null

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
function ToolboxIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7h-3V5a2 2 0 00-2-2H9a2 2 0 00-2 2v2H4a1 1 0 00-1 1v11a2 2 0 002 2h14a2 2 0 002-2V8a1 1 0 00-1-1zM9 7V5h6v2M3 12h18M10 12v2h4v-2"/></svg>
}
function UnderlineIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M6 4v6a6 6 0 0012 0V4M4 20h16" /></svg>
}
function StrikethroughIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M6 12h12M12 4c-2.5 0-5 1-5 3.5S9 11 12 12m0 0c3 .8 5 2 5 4.5S14.5 20 12 20c-2.5 0-5-1-5-3.5" /></svg>
}
function EraserIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20 20H7L3 16l9-9 6 6-3.5 3.5M6.5 17.5l4-4" /></svg>
}
function RedactIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="8" width="18" height="8" rx="1" fill="currentColor" opacity="0.3" /><rect x="3" y="8" width="18" height="8" rx="1" strokeLinecap="round" /></svg>
}
function CommentIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
}
