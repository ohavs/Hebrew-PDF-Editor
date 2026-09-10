import React from 'react'
import { useUIStore, usePDFStore } from '../../store'
import type { ToolType } from '../../store/types'
import type { CategoryId } from '../tools/PDFToolsModal'

const EASE = 'cubic-bezier(0.23,1,0.32,1)'

// ─── Annotation tools ────────────────────────────────────────
// Only tools NOT already in the bottom nav (select/text/highlight/draw live there)
const ANNOTATION_TOOLS: Array<{ id: ToolType; label: string; icon: React.ReactNode; color: string }> = [
  { id: 'edit-text',    label: 'ערוך טקסט', color: '#0ea5e9', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7V5h12v2M10 5v12M8 17h4"/><path strokeLinecap="round" strokeLinejoin="round" d="M14.5 20.5l6-6 2 2-6 6h-2v-2z"/></svg> },
  { id: 'eraser',       label: 'מחק',      color: '#64748b', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 20H7L3 16l9-9 6 6-3.5 3.5M6.5 17.5l4-4"/></svg> },
  { id: 'shapes',       label: 'צורות',    color: '#10b981', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><circle cx="17" cy="7" r="4"/><path strokeLinecap="round" strokeLinejoin="round" d="M7 17l5 5 5-5"/></svg> },
  { id: 'redact',       label: 'כיסוי',    color: '#64748b', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="8" rx="1" fill="currentColor" opacity="0.3"/><rect x="3" y="8" width="18" height="8" rx="1"/></svg> },
  { id: 'stamp',        label: 'חותמת',    color: '#dc2626', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg> },
  { id: 'signature',    label: 'חתימה',    color: '#7c3aed', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/><path strokeLinecap="round" d="M3 21h18" strokeWidth="1.5"/></svg> },
  { id: 'comment',      label: 'הערה',     color: '#f97316', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg> },
]

// ─── PDF tool categories ──────────────────────────────────────
const PDF_TOOLS: Array<{ id: CategoryId; label: string; desc: string; color: string; icon: React.ReactNode }> = [
  { id: 'organize',   label: 'ארגון דפים', desc: 'סובב, מחק, שכפל דפים',       color: '#6b7280', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
  { id: 'merge',      label: 'מיזוג',      desc: 'אחד קבצי PDF לקובץ אחד',      color: '#ef4444', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 8V5a2 2 0 012-2h6a2 2 0 012 2v3M9 21h6a2 2 0 002-2v-3M12 8v8M8 12h8"/></svg> },
  { id: 'split',      label: 'פיצול',      desc: 'פצל לקבצים נפרדים',           color: '#8b5cf6', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M4 11h16M6 11v8a2 2 0 002 2h2M18 11v8a2 2 0 01-2 2h-2"/></svg> },
  { id: 'extract',    label: 'חילוץ דפים', desc: 'שמור טווח דפים כקובץ חדש',   color: '#0ea5e9', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"/></svg> },
  { id: 'compress',   label: 'קימפרוס',    desc: 'הקטן את גודל הקובץ',          color: '#f59e0b', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 9L4 4m0 0v4m0-4h4M15 9l5-5m0 0v4m0-4h-4M9 15l-5 5m0 0v-4m0 4h4M15 15l5 5m0 0v-4m0 4h-4"/></svg> },
  { id: 'watermark',  label: 'סימן מים',   desc: 'הוסף טקסט על כל הדפים',       color: '#64748b', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 7l10 10M7 17L17 7" opacity="0.5"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg> },
  { id: 'reverse',    label: 'הפוך סדר',   desc: 'הפוך את סדר הדפים',           color: '#7c3aed', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16"/><path strokeLinecap="round" strokeLinejoin="round" d="M9 3l-5 4 5 4M15 13l5 4-5 4"/></svg> },
  { id: 'to-image',   label: 'PDF לתמונה', desc: 'ייצא דפים כ-PNG/JPG',         color: '#10b981', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 15l-5-5L5 21"/></svg> },
  { id: 'from-image', label: 'תמונה ל-PDF',desc: 'צור PDF מתמונות',             color: '#ec4899', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 4h6a2 2 0 012 2v6M4 8V6a2 2 0 012-2h2M4 14v4a2 2 0 002 2h4"/></svg> },
  { id: 'to-word',    label: 'PDF לוורד',  desc: 'ייצא את הטקסט כ-DOCX',        color: '#2563eb', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z"/><path strokeLinecap="round" strokeLinejoin="round" d="M8.5 12l1.5 5 2-4 2 4 1.5-5"/></svg> },
  { id: 'from-word',  label: 'וורד ל-PDF', desc: 'המר מסמך DOCX ל-PDF',         color: '#1d4ed8', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 11v6m0 0l-2.5-2.5M12 17l2.5-2.5"/></svg> },
  { id: 'flipbook',   label: 'פליפבוק ל-PDF', desc: 'הרכב PDF מעמודי פליפבוק',  color: '#a855f7', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v14M12 6C10.5 4.8 8.6 4 6 4H3v14h3c2.6 0 4.5.8 6 2M12 6c1.5-1.2 3.4-2 6-2h3v14h-3c-2.6 0-4.5.8-6 2"/></svg> },
  { id: 'unlock',     label: 'הסרת הגנה', desc: 'הסר סיסמה והגבלות',           color: '#059669', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="11" rx="2"/><path strokeLinecap="round" d="M8 10V7a4 4 0 017.5-2"/><path strokeLinecap="round" d="M12 14v3"/></svg> },
  { id: 'to-excel',   label: 'PDF לאקסל', desc: 'ייצא טבלאות כ-XLSX',          color: '#16a34a', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path strokeLinecap="round" d="M3 10h18M9 4v16"/><path strokeLinecap="round" d="M13 13l4 4m0-4l-4 4"/></svg> },
  { id: 'page-numbers', label: 'מספור', desc: 'הוסף מספרי עמודים',              color: '#0891b2', icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path strokeLinecap="round" d="M12 17h.01M9 7h6M9 11h6"/></svg> },
]

interface Props { open: boolean; onClose: () => void }

export const MobileToolsSheet: React.FC<Props> = ({ open, onClose }) => {
  const { activeTool, setTool, setToolboxOpen, setToolboxCategory, setSettingsOpen } = useUIStore()
  const { pdfDoc } = usePDFStore()

  if (!open) return null

  const handleTool = (id: ToolType) => {
    setTool(id)
    onClose()
  }

  const openPDFTool = (cat: CategoryId) => {
    setToolboxCategory(cat)
    setToolboxOpen(true)
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }} />

      {/* Sheet */}
      <div role="dialog" aria-modal="true" aria-label="כלים" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 510,
        background: 'var(--color-surface)',
        borderRadius: '24px 24px 0 0',
        maxHeight: '88vh',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
        animation: `sheetIn 0.3s ${EASE} both`,
        display: 'flex', flexDirection: 'column',
        paddingBottom: 'env(safe-area-inset-bottom, 16px)',
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-border)', margin: '12px auto 0', flexShrink: 0 }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 12px', flexShrink: 0 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-ink-black)' }}>כלים</span>
          <button onClick={onClose} aria-label="סגור" style={{
            width: 30, height: 30, borderRadius: 8, border: 'none',
            background: 'var(--color-surface-2)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-text)', WebkitTapHighlightColor: 'transparent',
          }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ overflowY: 'auto', padding: '0 16px 20px' }}>

          {/* ── PDF Tools section (always first) ─────────── */}
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
            כלי PDF
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 22 }}>
            {PDF_TOOLS.map(tool => {
              const isDisabled = !pdfDoc
              return (
                <button
                  key={tool.id}
                  disabled={isDisabled}
                  onClick={() => openPDFTool(tool.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 6, padding: '14px 6px', borderRadius: 16, border: 'none',
                    background: 'var(--color-surface-2)',
                    color: isDisabled ? 'var(--color-text-muted)' : tool.color,
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    opacity: isDisabled ? 0.4 : 1, fontFamily: 'inherit',
                    transition: `background 150ms ${EASE}, transform 120ms ${EASE}`,
                    WebkitTapHighlightColor: 'transparent',
                    minHeight: 84,
                  }}
                  onTouchStart={e => { if (!isDisabled) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.92)' }}
                  onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
                >
                  {tool.icon}
                  <span style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.25, textAlign: 'center', color: 'var(--color-text)' }}>{tool.label}</span>
                </button>
              )
            })}
          </div>

          {/* ── Annotation tools section ──────────────────── */}
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
            כלי עריכה
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {ANNOTATION_TOOLS.map(tool => {
              const isActive = activeTool === tool.id
              const isDisabled = !pdfDoc && tool.id !== 'select'
              return (
                <button
                  key={tool.id}
                  disabled={isDisabled}
                  onClick={() => handleTool(tool.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 5, padding: '12px 6px', borderRadius: 14, border: 'none',
                    background: isActive ? `${tool.color}15` : 'var(--color-surface-2)',
                    color: isActive ? tool.color : 'var(--color-text)',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    opacity: isDisabled ? 0.4 : 1, fontFamily: 'inherit',
                    outline: isActive ? `2px solid ${tool.color}40` : 'none',
                    transition: `background 150ms ${EASE}, transform 120ms ${EASE}`,
                    WebkitTapHighlightColor: 'transparent',
                    minHeight: 78,
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

          {/* Settings entry */}
          <button
            onClick={() => { setSettingsOpen(true); onClose() }}
            style={{
              width: '100%', marginTop: 14, padding: '13px 16px', borderRadius: 14, border: 'none',
              background: 'var(--color-surface-2)', cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 10,
              color: 'var(--color-text)', fontSize: 13.5, fontWeight: 600,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
            הגדרות
          </button>
        </div>
      </div>
    </>
  )
}
