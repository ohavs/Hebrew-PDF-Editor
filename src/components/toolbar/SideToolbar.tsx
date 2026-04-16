import React from 'react'
import { useTranslation } from 'react-i18next'
import { useUIStore, usePDFStore } from '../../store'
import type { ToolType } from '../../store/types'

const TOOLS: Array<{ id: ToolType; label: string; icon: React.ReactNode; group?: string }> = [
  { id: 'select', label: 'tools.select', icon: <SelectIcon />, group: 'base' },
  { id: 'text', label: 'tools.text', icon: <TextIcon />, group: 'base' },
  { id: 'highlight', label: 'tools.highlight', icon: <HighlightIcon />, group: 'annotate' },
  { id: 'draw', label: 'tools.draw', icon: <DrawIcon />, group: 'draw' },
  { id: 'shapes', label: 'tools.shapes', icon: <ShapesIcon />, group: 'draw' },
  { id: 'stamp', label: 'tools.stamp', icon: <StampIcon />, group: 'draw' },
  { id: 'forms', label: 'tools.forms', icon: <FormsIcon />, group: 'forms' },
  { id: 'signature', label: 'tools.signature', icon: <SigIcon />, group: 'forms' },
  { id: 'pages', label: 'tools.pages', icon: <PagesIcon />, group: 'pages' },
]

export const SideToolbar: React.FC = () => {
  const { t } = useTranslation()
  const { activeTool, setTool, setSidePanel, sideToolbarOpen, setSideToolbarOpen } = useUIStore()
  const { pdfDoc } = usePDFStore()

  const handleToolClick = (tool: ToolType) => {
    setTool(tool)
    if (tool === 'pages') setSidePanel('pages')
    else if (tool === 'forms') setSidePanel('forms')
  }

  const groups = ['base', 'annotate', 'draw', 'forms', 'pages']

  return (
    <div
      className="no-print desktop-only"
      style={{
        width: sideToolbarOpen ? 56 : 0,
        background: 'var(--color-surface)',
        borderInlineEnd: sideToolbarOpen ? '1px solid var(--color-border)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: sideToolbarOpen ? '10px 0' : 0,
        gap: 2,
        overflow: 'hidden',
        flexShrink: 0,
        zIndex: 100,
        transition: 'width 220ms cubic-bezier(0.23,1,0.32,1)',
      }}
    >
      {sideToolbarOpen && groups.map((group, gi) => (
        <React.Fragment key={group}>
          {gi > 0 && (
            <div style={{ width: 28, height: 1, background: 'var(--color-border)', margin: '5px 0' }} />
          )}
          {TOOLS.filter(t => t.group === group).map(tool => (
            <ToolBtn
              key={tool.id}
              title={t(tool.label)}
              active={activeTool === tool.id}
              disabled={!pdfDoc && tool.id !== 'select'}
              onClick={() => handleToolClick(tool.id)}
            >
              {tool.icon}
            </ToolBtn>
          ))}
        </React.Fragment>
      ))}
    </div>
  )
}

// Mobile bottom toolbar
export const BottomToolbar: React.FC = () => {
  const { t } = useTranslation()
  const { activeTool, setTool } = useUIStore()
  const { pdfDoc } = usePDFStore()

  const mobileTool = TOOLS.filter(t => ['select','text','highlight','draw','forms','signature'].includes(t.id))

  return (
    <div
      className="no-print mobile-only"
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: 60,
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '0 8px',
        zIndex: 300,
        boxShadow: '0 -2px 10px rgba(0,0,0,0.08)'
      }}
    >
      {mobileTool.map(tool => (
        <ToolBtn
          key={tool.id}
          title={t(tool.label)}
          active={activeTool === tool.id}
          disabled={!pdfDoc && tool.id !== 'select'}
          onClick={() => setTool(tool.id)}
          size={40}
        >
          {tool.icon}
        </ToolBtn>
      ))}
    </div>
  )
}

const ToolBtn: React.FC<{
  title: string; active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode; size?: number
}> = ({ title, active, disabled, onClick, children, size = 40 }) => (
  <button
    title={title}
    disabled={disabled}
    onClick={onClick}
    style={{
      width: size,
      height: size,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: active ? 'rgba(37,99,235,0.1)' : 'transparent',
      border: 'none',
      borderRadius: 10,
      cursor: disabled ? 'not-allowed' : 'pointer',
      color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
      opacity: disabled ? 0.35 : 1,
      position: 'relative',
      outline: 'none',
      flexShrink: 0,
      transition: 'background 150ms cubic-bezier(0.23,1,0.32,1), color 150ms cubic-bezier(0.23,1,0.32,1), transform 160ms cubic-bezier(0.23,1,0.32,1)',
    }}
    onMouseEnter={e => {
      if (!active && !disabled) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.05)'
    }}
    onMouseLeave={e => {
      if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
    }}
    onMouseDown={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.88)' }}
    onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
  >
    {/* Active accent bar on the right edge (toward the viewer) */}
    {active && (
      <span style={{
        position: 'absolute',
        insetInlineEnd: -1,
        top: 6,
        bottom: 6,
        width: 3,
        background: 'var(--color-accent)',
        borderRadius: '2px 0 0 2px',
        pointerEvents: 'none',
      }} />
    )}
    {children}
  </button>
)

// Tool Icons
function SelectIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3l7 19 3-7 7-3L3 3z"/></svg>
}
function TextIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>
}
function HighlightIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="14" width="18" height="5" rx="2" opacity="0.4" fill="#fde047"/><rect x="3" y="14" width="18" height="5" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/><path strokeLinecap="round" strokeLinejoin="round" stroke="currentColor" strokeWidth="1.5" d="M5 14V8a7 7 0 0114 0v6" fill="none"/></svg>
}
function DrawIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
}
function ShapesIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><circle cx="17" cy="7" r="4"/><path strokeLinecap="round" strokeLinejoin="round" d="M7 17l5 5 5-5"/></svg>
}
function StickyIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
}
function StampIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>
}
function FormsIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
}
function SigIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/><path strokeLinecap="round" d="M3 21h18" strokeWidth="1.5"/></svg>
}
function PagesIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H7m12 0a2 2 0 012 2v6a2 2 0 01-2 2H7a2 2 0 01-2-2v-6a2 2 0 012-2m12 0V9a2 2 0 00-2-2M7 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M9 7h6"/></svg>
}
