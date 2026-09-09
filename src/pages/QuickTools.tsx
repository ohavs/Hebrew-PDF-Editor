import React, { useRef, useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePDF } from '../hooks/usePDF'
import { usePDFStore, useUIStore, useAnnotationsStore } from '../store'
import { PDFToolsContent } from '../components/tools/PDFToolsModal'
import type { CategoryId } from '../components/tools/PDFToolsModal'
import { ToastContainer } from '../components/ui/Toast'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { PromptDialog } from '../components/ui/PromptDialog'

const EASE = 'cubic-bezier(0.23,1,0.32,1)'

export const TOOL_META: Array<{ id: CategoryId; label: string; desc: string; emoji: string }> = [
  { id: 'organize',   label: 'ארגון דפים',  desc: 'סובב, סדר, מחק ושכפל דפים', emoji: '🗂️' },
  { id: 'merge',      label: 'מיזוג PDF',   desc: 'אחד כמה קבצים לאחד',        emoji: '🔗' },
  { id: 'split',      label: 'פיצול PDF',   desc: 'פצל לקבצים נפרדים',          emoji: '✂️' },
  { id: 'extract',    label: 'חילוץ דפים',  desc: 'שמור טווח דפים כקובץ חדש',  emoji: '📑' },
  { id: 'compress',   label: 'דחיסת PDF',   desc: 'הקטן את גודל הקובץ',         emoji: '🗜️' },
  { id: 'watermark',  label: 'סימן מים',    desc: 'הוסף טקסט על כל הדפים',      emoji: '💧' },
  { id: 'reverse',    label: 'הפוך סדר',    desc: 'הפוך את סדר הדפים',          emoji: '🔄' },
  { id: 'to-image',   label: 'PDF לתמונה',  desc: 'ייצא דפים כ-PNG / JPG',      emoji: '🖼️' },
  { id: 'from-image', label: 'תמונה ל-PDF', desc: 'צור PDF מתמונות',            emoji: '📷' },
  { id: 'to-word',    label: 'PDF לוורד',   desc: 'ייצא את הטקסט כ-DOCX',       emoji: '📝' },
  { id: 'from-word',  label: 'וורד ל-PDF',  desc: 'המר מסמך DOCX ל-PDF',        emoji: '📄' },
  { id: 'to-excel',   label: 'PDF לאקסל',   desc: 'ייצא טבלאות כ-XLSX',         emoji: '📊' },
  { id: 'flipbook',   label: 'פליפבוק ל-PDF', desc: 'הרכב PDF מעמודי פליפבוק',   emoji: '📖' },
  { id: 'compare',    label: 'השוואת גרסאות', desc: 'מצא מה השתנה מול קובץ אחר', emoji: '🔍' },
  { id: 'unlock',     label: 'הסרת הגנה',    desc: 'הסר סיסמה והגבלות מקובץ',    emoji: '🔓' },
  { id: 'page-numbers', label: 'מספור עמודים', desc: 'הוסף מספרי עמודים',       emoji: '🔢' },
]

/**
 * Standalone quick-tools hub: pick a file, pick a tool, done — without
 * entering the full editor. Reuses the exact same tool panels as the
 * editor's toolbox, so there is a single implementation of every tool.
 */
export const QuickTools: React.FC = () => {
  const navigate = useNavigate()
  const { tool } = useParams<{ tool?: string }>()
  const { loadPDF } = usePDF()
  const { pdfDoc, fileName, clearPdf } = usePDFStore()
  const { darkMode } = useUIStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeTool, setActiveTool] = useState<CategoryId | null>(
    (TOOL_META.some(t => t.id === tool) ? tool as CategoryId : null)
  )
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  // Tools that work without an open document: converters that create a new
  // PDF, and merge (which manages its own multi-file list)
  const needsFile = !['from-image', 'from-word', 'merge', 'unlock', 'flipbook'].includes(activeTool ?? '')
  const showPanel = activeTool && (!needsFile || pdfDoc)
  const activeToolMeta = TOOL_META.find(t => t.id === activeTool) || null

  const handleFile = async (file: File) => {
    await loadPDF(file)
  }

  return (
    <div
      className="page-root"
      style={{
        background: 'var(--color-surface-2)',
        direction: 'rtl',
        fontFamily: 'var(--font-body)',
        color: 'var(--color-text)',
        display: 'flex', flexDirection: 'column',
      }}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault(); setDragging(false)
        const f = e.dataTransfer.files[0]
        if (f?.type === 'application/pdf') handleFile(f)
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 14px',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        height: 'calc(56px + env(safe-area-inset-top, 0px))',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <button
          aria-label="חזרה"
          onClick={() => activeTool ? setActiveTool(null) : navigate('/')}
          style={{
            width: 38, height: 38, borderRadius: 10, border: 'none', background: 'transparent',
            cursor: 'pointer', color: 'var(--color-text)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            WebkitTapHighlightColor: 'transparent', minHeight: 0, padding: 0,
          }}
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>
            {activeTool ? TOOL_META.find(t => t.id === activeTool)?.label : 'כלי PDF מהירים'}
          </div>
          {pdfDoc && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fileName}
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, maxWidth: 560, width: '100%', margin: '0 auto', padding: '16px clamp(12px, 4vw, 24px) 40px' }}>

        {/* Current file bar — always obvious which document the tools act on */}
        {pdfDoc && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--color-mint)',
            borderRadius: 16, padding: '12px 14px', marginBottom: 16,
          }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>📄</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-ink-black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {fileName}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>הכלים יפעלו על הקובץ הזה</div>
            </div>
            <button className="btn btn-secondary" style={{ fontSize: 12, flexShrink: 0 }} onClick={() => navigate('/editor')}>
              פתח בעורך
            </button>
            <button className="btn btn-secondary" style={{ fontSize: 12, flexShrink: 0 }} onClick={() => fileInputRef.current?.click()}>
              החלף
            </button>
            <button
              aria-label="סגור קובץ"
              title="סגור קובץ"
              onClick={() => {
                clearPdf()
                useAnnotationsStore.setState({ annotations: [], formFields: [], past: [], future: [], selectedId: null })
              }}
              style={{
                width: 36, height: 36, borderRadius: 10, border: 'none', flexShrink: 0,
                background: 'rgba(0,0,0,0.08)', cursor: 'pointer', color: 'var(--color-ink-black)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent', minHeight: 0, padding: 0,
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Selected tool — stays visible while waiting for a file, so it's
            always clear which tool you're in */}
        {activeToolMeta && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'var(--color-accent)', color: 'var(--color-on-accent)',
            borderRadius: 18, padding: '14px 16px', marginBottom: 14,
          }}>
            <span style={{ fontSize: 26, flexShrink: 0 }}>{activeToolMeta.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{activeToolMeta.label}</div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>{activeToolMeta.desc}</div>
            </div>
            {/* No switch button here — the panel below opens the full tool
                list, so a second way to do it only ate space */}
          </div>
        )}

        {/* Step 1: choose a file (when a tool needs one) */}
        {(!pdfDoc && (activeTool === null || needsFile)) && (
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? 'var(--color-accent)' : 'var(--color-border)'}`,
              borderRadius: 18,
              padding: '28px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: 'var(--color-surface)',
              marginBottom: 20,
              transition: `border-color 180ms ${EASE}, transform 150ms ${EASE}`,
              transform: dragging ? 'scale(1.01)' : 'none',
            }}
          >
            <div style={{ fontSize: 34, marginBottom: 8 }}>📄</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {activeToolMeta ? `בחר קובץ כדי להשתמש ב${activeToolMeta.label}` : 'בחר קובץ PDF'}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', marginTop: 4 }}>
              או גרור לכאן · הקבצים נשארים אצלך במכשיר
            </div>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          style={{ display: 'none' }}
          onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
        />

        {/* Step 2: the tool panel itself (same panels as the editor) */}
        {showPanel ? (
          <div style={{
            background: 'var(--color-surface)',
            borderRadius: 18,
            border: '1px solid var(--color-border)',
            overflow: 'hidden',
            minHeight: 320,
            animation: `fadeUp 0.25s ${EASE} both`,
          }}>
            <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }`}</style>
            <PDFToolsContent key={activeTool} onClose={() => setActiveTool(null)} initialCategory={activeTool!} />
          </div>
        ) : (
          /* Tool grid */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
            {TOOL_META.map(t => {
              const isActive = t.id === activeTool
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTool(t.id)}
                  aria-pressed={isActive}
                  style={{
                    position: 'relative',
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
                    padding: '16px 14px', borderRadius: 16,
                    border: `2px solid ${isActive ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    background: isActive ? 'var(--color-mint)' : 'var(--color-surface)',
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'start',
                    transition: `transform 140ms ${EASE}, border-color 140ms ease, background 140ms ease`,
                    WebkitTapHighlightColor: 'transparent',
                    minHeight: 0,
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-accent)' }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)' }}
                  onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)' }}
                  onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
                >
                  {isActive && (
                    <span style={{
                      position: 'absolute', top: 10, insetInlineEnd: 10,
                      width: 20, height: 20, borderRadius: '50%',
                      background: 'var(--color-accent)', color: 'var(--color-on-accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3.2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  )}
                  <span style={{ fontSize: 26 }}>{t.emoji}</span>
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: isActive ? 'var(--color-ink-black)' : 'var(--color-text)' }}>{t.label}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>{t.desc}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <ToastContainer />
      <ConfirmDialog />
      <PromptDialog />
    </div>
  )
}
