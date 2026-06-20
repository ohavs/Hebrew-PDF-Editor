import React from 'react'
import { useUIStore, usePDFStore } from '../../store'
import type { ToolType } from '../../store/types'

const EASE = 'cubic-bezier(0.23,1,0.32,1)'

const ALL_TOOLS: Array<{ id: ToolType; label: string; icon: React.ReactNode; color: string }> = [
  { id: 'select', label: 'בחר', color: '#6b7280', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3l7 19 3-7 7-3L3 3z"/></svg> },
  { id: 'text', label: 'טקסט', color: '#2563eb', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7V4h16v3M9 20h6M12 4v16"/></svg> },
  { id: 'highlight', label: 'הדגשה', color: '#f59e0b', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536-8.5 8.5H7v-3.268l8.232-8.232z"/></svg> },
  { id: 'underline', label: 'קו תחתון', color: '#0ea5e9', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 4v6a6 6 0 0012 0V4M4 20h16"/></svg> },
  { id: 'strikethrough', label: 'קו חוצה', color: '#8b5cf6', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 12h12M12 4c-2.5 0-5 1-5 3.5S9 11 12 12m0 0c3 .8 5 2 5 4.5S14.5 20 12 20c-2.5 0-5-1-5-3.5"/></svg> },
  { id: 'draw', label: 'ציור', color: '#ef4444', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg> },
  { id: 'eraser', label: 'מחק', color: '#64748b', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 20H7L3 16l9-9 6 6-3.5 3.5M6.5 17.5l4-4"/></svg> },
  { id: 'shapes', label: 'צורות', color: '#10b981', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><circle cx="17" cy="7" r="4"/><path strokeLinecap="round" strokeLinejoin="round" d="M7 17l5 5 5-5"/></svg> },
  { id: 'redact', label: 'כיסוי', color: '#000', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="8" rx="1" fill="currentColor" opacity="0.3"/><rect x="3" y="8" width="18" height="8" rx="1"/></svg> },
  { id: 'stamp', label: 'חותמת', color: '#dc2626', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg> },
  { id: 'signature', label: 'חתימה', color: '#7c3aed', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/><path strokeLinecap="round" d="M3 21h18" strokeWidth="1.5"/></svg> },
  { id: 'comment', label: 'הערה', color: '#f97316', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg> },
]

interface Props { open: boolean; onClose: () => void }

export const MobileToolsSheet: React.FC<Props> = ({ open, onClose }) => {
  const { activeTool, setTool, setToolboxOpen } = useUIStore()
  const { pdfDoc } = usePDFStore()

  if (!open) return null

  const handleTool = (id: ToolType) => {
    setTool(id)
    onClose()
  }

  const openPDFTools = () => {
    setToolboxOpen(true)
    onClose()
  }

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 510,
        background: 'var(--color-surface)',
        borderRadius: '24px 24px 0 0',
        maxHeight: '80vh',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
        animation: `sheetIn 0.3s ${EASE} both`,
        display: 'flex', flexDirection: 'column',
        paddingBottom: 'env(safe-area-inset-bottom, 16px)',
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-border)', margin: '12px auto 0', flexShrink: 0 }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 8px', flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-ink-black)' }}>כלי עריכה</span>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'var(--color-surface-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text)' }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Tool grid */}
        <div style={{ overflowY: 'auto', padding: '8px 16px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {ALL_TOOLS.map(tool => {
              const isActive = activeTool === tool.id
              const isDisabled = !pdfDoc && tool.id !== 'select'
              return (
                <button
                  key={tool.id}
                  disabled={isDisabled}
                  onClick={() => handleTool(tool.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 6, padding: '14px 8px', borderRadius: 16, border: 'none',
                    background: isActive ? `${tool.color}15` : 'var(--color-surface-2)',
                    color: isActive ? tool.color : 'var(--color-text)',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    opacity: isDisabled ? 0.4 : 1, fontFamily: 'inherit',
                    outline: isActive ? `2px solid ${tool.color}40` : 'none',
                    transition: `background 150ms ${EASE}, transform 120ms ${EASE}`,
                    WebkitTapHighlightColor: 'transparent',
                    minHeight: 80,
                  }}
                  onTouchStart={e => { if (!isDisabled) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.92)' }}
                  onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
                >
                  {tool.icon}
                  <span style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.2, textAlign: 'center' }}>{tool.label}</span>
                </button>
              )
            })}
          </div>

          {/* PDF Tools section */}
          {pdfDoc && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '16px 0 10px' }}>
                כלי PDF
              </div>
              <button
                onClick={openPDFTools}
                style={{
                  width: '100%', padding: '14px 16px', borderRadius: 16, border: 'none',
                  background: 'var(--color-surface-2)', cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 12,
                  transition: `background 150ms ${EASE}, transform 120ms ${EASE}`,
                  WebkitTapHighlightColor: 'transparent',
                }}
                onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)' }}
                onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
              >
                <span style={{ width: 40, height: 40, borderRadius: 11, background: '#00000012', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7h-3V5a2 2 0 00-2-2H9a2 2 0 00-2 2v2H4a1 1 0 00-1 1v11a2 2 0 002 2h14a2 2 0 002-2V8a1 1 0 00-1-1zM9 7V5h6v2M3 12h18M10 12v2h4v-2"/></svg>
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-ink-black)' }}>כלי PDF</span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>מיזוג, פיצול, קימפרוס ועוד</span>
                </span>
                <svg style={{ marginRight: 'auto' }} width="16" height="16" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
