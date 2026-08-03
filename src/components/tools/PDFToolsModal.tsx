import React, { useState } from 'react'
import { usePDFStore } from '../../store'
import { useDownloadDocument } from '../../hooks/usePageOps'
import { EASE, Spinner } from './toolsShared'
import { CATEGORIES } from './categories'
import type { CategoryId } from './categories'
import { OrganizePanel } from './panels/OrganizePanel'
import { MergePanel } from './panels/MergePanel'
import { SplitPanel } from './panels/SplitPanel'
import { ExtractPanel } from './panels/ExtractPanel'
import { CompressPanel } from './panels/CompressPanel'
import { WatermarkPanel } from './panels/WatermarkPanel'
import { ReversePanel } from './panels/ReversePanel'
import { ToImagePanel } from './panels/ToImagePanel'
import { FromImagePanel } from './panels/FromImagePanel'
import { ToWordPanel } from './panels/ToWordPanel'
import { FromWordPanel } from './panels/FromWordPanel'
import { ToExcelPanel } from './panels/ToExcelPanel'
import { PageNumbersPanel } from './panels/PageNumbersPanel'

export type { CategoryId } from './categories'

export const PDFToolsContent: React.FC<{ onClose: () => void; initialCategory?: CategoryId }> = ({ onClose, initialCategory }) => {
  const [active, setActive] = useState<CategoryId>(initialCategory || 'organize')
  // The full tool list is a lot of vertical space to keep on screen, so it
  // collapses to a single row naming the current tool.
  const [listOpen, setListOpen] = useState(false)
  const activeCat = CATEGORIES.find(c => c.id === active)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', borderBottom: '1px solid var(--color-border)', flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-ink-black)' }}>כלי PDF</span>
        <button onClick={onClose} aria-label="סגור" style={{
          width: 26, height: 26, borderRadius: 7, border: 'none', cursor: 'pointer',
          background: 'var(--color-surface-2)', color: 'var(--color-text)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Current tool — tap to reveal the full list */}
      <button
        onClick={() => setListOpen(o => !o)}
        aria-expanded={listOpen}
        aria-label={listOpen ? 'סגור את רשימת הכלים' : 'הצג את כל הכלים'}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '10px 12px', border: 'none', cursor: 'pointer',
          background: 'var(--color-surface)', color: 'var(--color-text)',
          fontFamily: 'inherit', textAlign: 'start', flexShrink: 0,
          borderBottom: '1px solid var(--color-border)',
          WebkitTapHighlightColor: 'transparent', minHeight: 0,
        }}
      >
        <span style={{
          width: 28, height: 28, borderRadius: 9, flexShrink: 0,
          background: 'var(--color-accent)', color: 'var(--color-on-accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {activeCat?.icon}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{activeCat?.label}</span>
          <span style={{
            display: 'block', fontSize: 10.5, color: 'var(--color-text-muted)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {listOpen ? 'בחר כלי מהרשימה' : activeCat?.desc}
          </span>
        </span>
        <svg
          width="16" height="16" fill="none" stroke="var(--color-text-muted)" strokeWidth="2.4" viewBox="0 0 24 24"
          style={{
            flexShrink: 0,
            transform: listOpen ? 'rotate(180deg)' : 'none',
            transition: `transform 240ms ${EASE}`,
          }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Full tool list — collapsed by default. The 0fr→1fr grid trick
          animates to the content's natural height without measuring it. */}
      <div style={{
        display: 'grid',
        gridTemplateRows: listOpen ? '1fr' : '0fr',
        transition: `grid-template-rows 260ms ${EASE}`,
        flexShrink: 0,
        borderBottom: listOpen ? '1px solid var(--color-border)' : 'none',
      }}>
        {/* A zero-height grid row still leaves its children with a real box,
            so screen readers and pointer hits could reach the hidden pills.
            visibility takes them out entirely, delayed so the close animation
            still plays. */}
        <div style={{
          overflow: 'hidden',
          visibility: listOpen ? 'visible' : 'hidden',
          transition: `visibility 0s linear ${listOpen ? '0s' : '260ms'}`,
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 10px' }}>
            {CATEGORIES.map(cat => {
              const isActive = active === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => { setActive(cat.id); setListOpen(false) }}
                  aria-pressed={isActive}
                  tabIndex={listOpen ? 0 : -1}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
                    background: isActive ? 'var(--color-accent)' : 'var(--color-surface-2)',
                    color: isActive ? 'var(--color-on-accent)' : 'var(--color-text-muted)',
                    fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                    flexShrink: 0, transition: 'background 150ms ease-out, color 150ms ease-out',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ opacity: isActive ? 1 : 0.6 }}>{cat.icon}</span>
                  {cat.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        <ToolPanel category={active} />
      </div>

      {/* Always-available download — finishing a tool never requires
          a detour through the editor */}
      <DownloadFooter />
    </div>
  )
}

/** Sticky "download the document" bar, visible in every tool. */
const DownloadFooter: React.FC = () => {
  const { pdfDoc, fileName, pageCount } = usePDFStore()
  const { download } = useDownloadDocument()
  const [busy, setBusy] = useState(false)

  if (!pdfDoc) return null

  const run = async () => {
    setBusy(true)
    try { await download() } finally { setBusy(false) }
  }

  return (
    <div style={{
      flexShrink: 0,
      borderTop: '1px solid var(--color-border)',
      background: 'var(--color-surface)',
      padding: '10px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: 'var(--color-text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {fileName}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)' }}>
          {pageCount} עמודים · כולל כל העריכות והשכבות
        </div>
      </div>
      <button
        onClick={run}
        disabled={busy}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
          padding: '10px 16px', borderRadius: 12, border: 'none',
          background: 'var(--color-accent)', color: 'var(--color-on-accent)',
          fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
          cursor: busy ? 'wait' : 'pointer',
          opacity: busy ? 0.6 : 1,
          WebkitTapHighlightColor: 'transparent',
          transition: `transform 140ms ${EASE}`,
        }}
        onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)' }}
        onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
      >
        {busy ? <Spinner /> : (
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        )}
        הורד PDF
      </button>
    </div>
  )
}

// Keep the outer PDFToolsModal as a no-op since LeftPanel handles it now
export const PDFToolsModal: React.FC = () => null

/** Routes the chosen category to its panel. */
const ToolPanel: React.FC<{ category: CategoryId }> = ({ category }) => {
  switch (category) {
    case 'organize': return <OrganizePanel />
    case 'merge': return <MergePanel />
    case 'split': return <SplitPanel />
    case 'extract': return <ExtractPanel />
    case 'compress': return <CompressPanel />
    case 'watermark': return <WatermarkPanel />
    case 'reverse': return <ReversePanel />
    case 'to-image': return <ToImagePanel />
    case 'from-image': return <FromImagePanel />
    case 'to-word': return <ToWordPanel />
    case 'from-word': return <FromWordPanel />
    case 'to-excel': return <ToExcelPanel />
    case 'page-numbers': return <PageNumbersPanel />
  }
}
