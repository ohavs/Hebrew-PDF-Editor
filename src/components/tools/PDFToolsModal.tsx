import React, { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import { usePDFStore, useUIStore, useAnnotationsStore } from '../../store'
import type { TextBoxAnnotation } from '../../store/types'
import { usePDF } from '../../hooks/usePDF'
import { downloadBlob, triggerDownload } from '../../utils/pdfExport'
import { useEditedBytes, usePageOps, useDownloadDocument } from '../../hooks/usePageOps'
import { PageListPanel } from '../panels/PageListPanel'
import { askFileName } from '../ui/PromptDialog'
import { extractParagraphs, buildDocx, parseDocx, renderParagraphsToPages, layoutParagraphsToBoxes } from '../../utils/wordConvert'
import {
  EASE, Spinner, EmptyHint, InfoBar, FilePicker, FileRow, SegmentedControl,
  PrimaryButton, GhostButton, renderPageCanvas, loadEditedForRender, parseRanges,
} from './toolsShared'
import { MergePanel } from './panels/MergePanel'


export type CategoryId =
  | 'organize' | 'merge' | 'split' | 'extract'
  | 'compress' | 'to-image' | 'from-image'
  | 'watermark' | 'reverse'
  | 'to-word' | 'from-word' | 'page-numbers'

interface Category {
  id: CategoryId
  label: string
  desc: string
  icon: React.ReactNode
  color: string
}

const CATEGORIES: Category[] = [
  { id: 'organize', label: 'ארגון דפים', desc: 'סובב, מחק, שכפל והוסף דפים', color: '#000000', icon: <OrganizeIcon /> },
  { id: 'merge', label: 'מיזוג', desc: 'אחד קבצי PDF לקובץ אחד', color: '#ef4444', icon: <MergeIcon /> },
  { id: 'split', label: 'פיצול', desc: 'פצל לדפים נפרדים', color: '#8b5cf6', icon: <SplitIcon /> },
  { id: 'extract', label: 'חילוץ דפים', desc: 'שמור טווח דפים כקובץ חדש', color: '#0ea5e9', icon: <ExtractIcon /> },
  { id: 'compress', label: 'קימפרוס', desc: 'הקטן את גודל הקובץ', color: '#f59e0b', icon: <CompressIcon /> },
  { id: 'watermark', label: 'סימן מים', desc: 'הוסף טקסט על כל הדפים', color: '#64748b', icon: <WatermarkIcon /> },
  { id: 'reverse', label: 'הפוך סדר', desc: 'הפוך את סדר הדפים', color: '#7c3aed', icon: <ReverseIcon /> },
  { id: 'to-image', label: 'PDF לתמונה', desc: 'ייצא דפים כ-PNG / JPG', color: '#10b981', icon: <ImageIcon /> },
  { id: 'from-image', label: 'תמונה ל-PDF', desc: 'צור PDF מתמונות', color: '#ec4899', icon: <FromImageIcon /> },
  { id: 'to-word', label: 'PDF לוורד', desc: 'ייצא את הטקסט כ-DOCX', color: '#2563eb', icon: <WordIcon /> },
  { id: 'from-word', label: 'וורד ל-PDF', desc: 'המר מסמך DOCX ל-PDF', color: '#1d4ed8', icon: <FromWordIcon /> },
  { id: 'page-numbers', label: 'מספור עמודים', desc: 'הוסף מספרי עמודים', color: '#0891b2', icon: <NumbersIcon /> },
]

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

// ─────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────
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
    case 'page-numbers': return <PageNumbersPanel />
  }
}

// ─────────────────────────────────────────────────────────────
// Organize
// ─────────────────────────────────────────────────────────────
const OrganizePanel: React.FC = () => {
  const { pdfDoc, currentPage, pageCount, pageOrder, pageInfos } = usePDFStore()
  const { addBlankAfter, rotateAllPages } = usePageOps()
  const [busy, setBusy] = useState(false)

  if (!pdfDoc) return <EmptyHint />

  const run = (fn: () => Promise<unknown>) => async () => {
    if (busy) return
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  const displayPos = Math.max(0, pageOrder.indexOf(currentPage))
  const info = pageInfos[currentPage]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <InfoBar text={`${pageCount} דפים. גרור מהידית לשינוי סדר, או השתמש בכפתורי השורה.`} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} disabled={busy}
          onClick={run(rotateAllPages)}>⟳ סובב הכל</button>
        <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} disabled={busy}
          onClick={run(() => addBlankAfter(displayPos, info ? [info.width, info.height] : undefined))}>＋ דף ריק</button>
      </div>
      <PageListPanel />
      {busy && <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)' }}><Spinner /> מעבד…</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Merge
// ─────────────────────────────────────────────────────────────
const SplitPanel: React.FC = () => {
  const { pdfDoc, pageCount, fileName } = usePDFStore()
  const { addToast } = useUIStore()
  const [busy, setBusy] = useState(false)
  const [splitMode, setSplitMode] = useState<'each' | 'ranges'>('each')
  const [splitRanges, setSplitRanges] = useState('')
  const getEdited = useEditedBytes()

  if (!pdfDoc) return <EmptyHint />

  const splitEach = async () => {
    setBusy(true)
    try {
      const src = await PDFDocument.load(await getEdited({ withDecorations: true }))
      const baseName = fileName.replace(/\.pdf$/i, '')
      for (let i = 0; i < pageCount; i++) {
        const dest = await PDFDocument.create()
        const [pg] = await dest.copyPages(src, [i])
        dest.addPage(pg)
        downloadBlob(await dest.save(), `${baseName}-עמוד-${i + 1}.pdf`)
        await new Promise(r => setTimeout(r, 250))
      }
      addToast(`המסמך פוצל ל-${pageCount} קבצים`, 'success')
    } catch { addToast('שגיאה בפיצול', 'error') } finally { setBusy(false) }
  }

  const splitByRanges = async () => {
    // Parse comma-separated groups like "1-3, 4-6, 7"
    const groups = splitRanges.split(',').map(g => g.trim()).filter(Boolean)
    if (!groups.length) { addToast('הזן טווחים תקינים', 'warning'); return }
    setBusy(true)
    try {
      const src = await PDFDocument.load(await getEdited({ withDecorations: true }))
      const baseName = fileName.replace(/\.pdf$/i, '')
      for (let gi = 0; gi < groups.length; gi++) {
        const pages = parseRanges(groups[gi], pageCount)
        if (!pages.length) continue
        const dest = await PDFDocument.create()
        const copied = await dest.copyPages(src, pages.map(p => p - 1))
        copied.forEach(p => dest.addPage(p))
        downloadBlob(await dest.save(), `${baseName}-חלק-${gi + 1}.pdf`)
        await new Promise(r => setTimeout(r, 250))
      }
      addToast(`המסמך פוצל ל-${groups.length} קבצים`, 'success')
    } catch { addToast('שגיאה בפיצול', 'error') } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InfoBar text={`המסמך (${pageCount} דפים) יפוצל לקבצי PDF נפרדים.`} />
      <SegmentedControl
        label="מצב פיצול"
        value={splitMode}
        options={[{ value: 'each', label: 'דף לכל קובץ' }, { value: 'ranges', label: 'טווחים מותאמים' }]}
        onChange={v => setSplitMode(v as 'each' | 'ranges')}
      />
      {splitMode === 'ranges' && (
        <div>
          <label className="label">טווחים (מופרדים בפסיק)</label>
          <input
            className="input"
            value={splitRanges}
            onChange={e => setSplitRanges(e.target.value)}
            placeholder="לדוגמה: 1-3, 4-6, 7"
            dir="ltr"
            inputMode="numeric"
            onFocus={e => setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)}
            style={{ width: '100%', textAlign: 'center' }}
          />
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
            כל קבוצה תהפוך לקובץ נפרד
          </div>
        </div>
      )}
      <PrimaryButton onClick={splitMode === 'each' ? splitEach : splitByRanges} disabled={busy}>
        {busy ? <><Spinner /> מפצל…</> : splitMode === 'each' ? `פצל ל-${pageCount} קבצים נפרדים` : 'פצל לפי טווחים'}
      </PrimaryButton>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Extract
// ─────────────────────────────────────────────────────────────
const ExtractPanel: React.FC = () => {
  const { pdfDoc, pageCount, fileName } = usePDFStore()
  const { addToast } = useUIStore()
  const [range, setRange] = useState('')
  const [busy, setBusy] = useState(false)
  const getEdited = useEditedBytes()

  if (!pdfDoc) return <EmptyHint />

  const extract = async () => {
    const pages = parseRanges(range, pageCount)
    if (!pages.length) { addToast('הזן טווח דפים תקין', 'warning'); return }
    const extractName = await askFileName(`${fileName.replace(/\.pdf$/i, '')}-חילוץ.pdf`, '.pdf')
    if (!extractName) return
    setBusy(true)
    try {
      const src = await PDFDocument.load(await getEdited({ withDecorations: true }))
      const dest = await PDFDocument.create()
      const copied = await dest.copyPages(src, pages.map(p => p - 1))
      copied.forEach(p => dest.addPage(p))
      downloadBlob(await dest.save(), extractName)
      addToast(`${pages.length} דפים חולצו`, 'success')
    } catch { addToast('שגיאה בחילוץ', 'error') } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InfoBar text={`הזן אילו דפים לחלץ (1 עד ${pageCount}). לדוגמה: 1-3, 5, 8`} />
      <div>
        <label className="label">טווח דפים</label>
        <input
          className="input" value={range} onChange={e => setRange(e.target.value)}
          placeholder="לדוגמה: 1-3, 5" dir="ltr" inputMode="numeric"
          onFocus={e => setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)}
          style={{ width: '100%', textAlign: 'center', direction: 'ltr' }}
        />
      </div>
      <PrimaryButton onClick={extract} disabled={busy || !range.trim()}>
        {busy ? <><Spinner /> מחלץ…</> : 'חלץ דפים לקובץ חדש'}
      </PrimaryButton>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Compress
// ─────────────────────────────────────────────────────────────
const CompressPanel: React.FC = () => {
  const { pdfDoc, pageCount, fileName } = usePDFStore()
  const { addToast } = useUIStore()
  const [quality, setQuality] = useState(0.6)
  const [busy, setBusy] = useState(false)
  const getEdited = useEditedBytes()

  if (!pdfDoc) return <EmptyHint />

  const compress = async () => {
    const outName = await askFileName(`${fileName.replace(/\.pdf$/i, '')}-דחוס.pdf`, '.pdf')
    if (!outName) return
    setBusy(true)
    try {
      // Render the EDITED document so annotations/signatures are included
      const edited = await loadEditedForRender(getEdited)
      const out = await PDFDocument.create()
      const scale = quality < 0.5 ? 1.0 : 1.3
      for (let i = 1; i <= edited.numPages; i++) {
        const canvas = await renderPageCanvas(edited, i, scale)
        const jpeg = canvas.toDataURL('image/jpeg', quality)
        const bytes = Uint8Array.from(atob(jpeg.split(',')[1]), c => c.charCodeAt(0))
        const img = await out.embedJpg(bytes)
        const page = out.addPage([canvas.width, canvas.height])
        page.drawImage(img, { x: 0, y: 0, width: canvas.width, height: canvas.height })
      }
      edited.destroy()
      const saved = await out.save()
      downloadBlob(saved, outName)
      addToast(`הקובץ נדחס (${(saved.length / 1024 / 1024).toFixed(1)}MB)`, 'success')
    } catch (e) { console.error(e); addToast('שגיאה בקימפרוס', 'error') } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InfoBar text="הקימפרוס ממיר דפים לתמונות באיכות מבוקרת — אידיאלי למסמכים סרוקים. שים לב: טקסט הופך לתמונה." />
      <div>
        <label className="label">איכות: {Math.round(quality * 100)}%</label>
        <input type="range" min={0.3} max={0.9} step={0.1} value={quality}
          onChange={e => setQuality(parseFloat(e.target.value))} style={{ width: '100%' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
          <span>קובץ קטן</span><span>איכות גבוהה</span>
        </div>
      </div>
      <PrimaryButton onClick={compress} disabled={busy}>
        {busy ? <><Spinner /> דוחס…</> : 'דחוס והורד'}
      </PrimaryButton>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// To Image
// ─────────────────────────────────────────────────────────────
const ToImagePanel: React.FC = () => {
  const { pdfDoc, pageCount, currentPage, pageOrder, fileName } = usePDFStore()
  const { addToast } = useUIStore()
  const [format, setFormat] = useState<'png' | 'jpeg'>('png')
  const [scope, setScope] = useState<'current' | 'all' | 'custom'>('all')
  const [customRange, setCustomRange] = useState('')
  const [busy, setBusy] = useState(false)
  const getEdited = useEditedBytes()

  if (!pdfDoc) return <EmptyHint />

  const currentDisplayNum = Math.max(0, pageOrder.indexOf(currentPage)) + 1

  const exportImages = async () => {
    setBusy(true)
    try {
      const base = fileName.replace(/\.pdf$/i, '')
      const pages = scope === 'current' ? [currentDisplayNum]
        : scope === 'custom' ? parseRanges(customRange, pageCount)
        : Array.from({ length: pageCount }, (_, i) => i + 1)
      if (!pages.length) { addToast('הזן טווח דפים תקין', 'warning'); setBusy(false); return }
      // Render the EDITED document so annotations/signatures are included
      const edited = await loadEditedForRender(getEdited)
      for (const num of pages) {
        const canvas = await renderPageCanvas(edited, num, 2)
        const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, `image/${format}`, 0.92))
        if (blob) triggerDownload(blob, `${base}-עמוד-${num}.${format === 'jpeg' ? 'jpg' : 'png'}`)
        await new Promise(r => setTimeout(r, 250))
      }
      edited.destroy()
      addToast(`${pages.length} תמונות יוצאו`, 'success')
    } catch (e) { console.error(e); addToast('שגיאה בייצוא תמונות', 'error') } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InfoBar text="ייצא דפי PDF כקבצי תמונה ברזולוציה גבוהה." />
      <SegmentedControl
        label="פורמט"
        value={format}
        options={[{ value: 'png', label: 'PNG' }, { value: 'jpeg', label: 'JPG' }]}
        onChange={v => setFormat(v as 'png' | 'jpeg')}
      />
      <SegmentedControl
        label="טווח"
        value={scope}
        options={[
          { value: 'all', label: `כל (${pageCount})` },
          { value: 'current', label: `נוכחי (${currentDisplayNum})` },
          { value: 'custom', label: 'בחירה ידנית' },
        ]}
        onChange={v => setScope(v as 'current' | 'all' | 'custom')}
      />
      {scope === 'custom' && (
        <input
          className="input"
          value={customRange}
          onChange={e => setCustomRange(e.target.value)}
          placeholder="לדוגמה: 1-3, 5, 8"
          dir="ltr"
          inputMode="numeric"
          onFocus={e => setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)}
          style={{ width: '100%', textAlign: 'center' }}
        />
      )}
      <PrimaryButton onClick={exportImages} disabled={busy}>
        {busy ? <><Spinner /> מייצא…</> : 'ייצא תמונות'}
      </PrimaryButton>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// From Image
// ─────────────────────────────────────────────────────────────
const FromImagePanel: React.FC = () => {
  const { pdfDoc } = usePDFStore()
  const { addToast } = useUIStore()
  const { loadPDF } = usePDF()
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)

  const build = async (mode: 'new' | 'append') => {
    if (!files.length) return
    setBusy(true)
    try {
      const doc = mode === 'append' && pdfDoc
        ? await PDFDocument.load(usePDFStore.getState().pdfBytes!.slice())
        : await PDFDocument.create()
      for (const f of files) {
        const bytes = new Uint8Array(await f.arrayBuffer())
        const img = f.type.includes('png') ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
        const page = doc.addPage([img.width, img.height])
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height })
      }
      const saved = await doc.save()
      if (mode === 'append') { await loadPDF(saved.buffer as ArrayBuffer, { name: usePDFStore.getState().fileName }); addToast('התמונות נוספו למסמך', 'success') }
      else { downloadBlob(saved, 'תמונות.pdf'); addToast('נוצר PDF מהתמונות', 'success') }
      setFiles([])
    } catch { addToast('שגיאה ביצירת PDF', 'error') } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InfoBar text="בחר תמונות (PNG / JPG) — כל תמונה תהפוך לדף ב-PDF." />
      <FilePicker accept="image/png,image/jpeg" multiple label="בחר תמונות" onPick={fs => setFiles(prev => [...prev, ...fs])} />
      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {files.map((f, i) => (
            <FileRow key={i} name={f.name} size={f.size} onRemove={() => setFiles(prev => prev.filter((_, j) => j !== i))} />
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        <PrimaryButton onClick={() => build('new')} disabled={busy || !files.length}>
          {busy ? <><Spinner /> יוצר…</> : 'צור PDF חדש'}
        </PrimaryButton>
        {pdfDoc && (
          <GhostButton onClick={() => build('append')} disabled={busy || !files.length}>
            הוסף למסמך הנוכחי
          </GhostButton>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Reusable UI bits
// ─────────────────────────────────────────────────────────────
const WatermarkPanel: React.FC = () => {
  const { pdfDoc, watermark, setWatermark } = usePDFStore()
  const { addToast } = useUIStore()
  const [text, setText] = useState(watermark?.text ?? 'טיוטה')
  const [opacity, setOpacity] = useState(watermark?.opacity ?? 0.2)
  const [fontSize, setFontSize] = useState(watermark?.fontSize ?? 80)

  if (!pdfDoc) return <EmptyHint />

  const apply = () => {
    if (!text.trim()) { addToast('הזן טקסט לסימן המים', 'warning'); return }
    setWatermark({
      text: text.trim(), fontSize, opacity,
      dx: watermark?.dx ?? 0, dy: watermark?.dy ?? 0,
    })
    addToast(watermark ? 'סימן המים עודכן' : 'סימן המים נוסף — גרור אותו על הדף למיקום אחר', 'success')
  }

  const remove = () => {
    setWatermark(null)
    addToast('סימן המים הוסר', 'success')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InfoBar text="סימן המים מוצג על כל הדפים כשכבה חיה: אפשר לגרור אותו, לעדכן או להסיר בכל רגע. הוא נטבע בקובץ רק בשמירה." />
      <div>
        <label className="label">טקסט סימן המים</label>
        <input className="input" value={text} onChange={e => setText(e.target.value)}
          placeholder="לדוגמה: טיוטה, סודי, DRAFT" style={{ width: '100%' }} />
      </div>
      <div>
        <label className="label">גודל: {fontSize}px</label>
        <input type="range" min={40} max={160} step={10} value={fontSize}
          onChange={e => setFontSize(parseInt(e.target.value))} style={{ width: '100%' }} />
      </div>
      <div>
        <label className="label">שקיפות: {Math.round(opacity * 100)}%</label>
        <input type="range" min={0.05} max={0.5} step={0.05} value={opacity}
          onChange={e => setOpacity(parseFloat(e.target.value))} style={{ width: '100%' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
          <span>שקוף יותר</span><span>בולט יותר</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <PrimaryButton onClick={apply} disabled={!text.trim()}>
          {watermark ? 'עדכן סימן מים' : 'הוסף סימן מים'}
        </PrimaryButton>
        {watermark && (
          <GhostButton onClick={remove}>הסר</GhostButton>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Reverse pages
// ─────────────────────────────────────────────────────────────
const ReversePanel: React.FC = () => {
  const { pdfDoc, pageCount, fileName } = usePDFStore()
  const { addToast } = useUIStore()
  const { loadPDF } = usePDF()
  const [busy, setBusy] = useState(false)
  const getEdited = useEditedBytes()

  if (!pdfDoc) return <EmptyHint />

  const reverse = async () => {
    setBusy(true)
    try {
      const src = await PDFDocument.load(await getEdited())
      const dest = await PDFDocument.create()
      const order = Array.from({ length: pageCount }, (_, i) => pageCount - 1 - i)
      const pages = await dest.copyPages(src, order)
      pages.forEach(p => dest.addPage(p))
      await loadPDF((await dest.save()).buffer as ArrayBuffer, { name: fileName })
      addToast('סדר הדפים הופך', 'success')
    } catch { addToast('שגיאה בהיפוך סדר', 'error') } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InfoBar text={`המסמך (${pageCount} דפים) יהפוך סדר: הדף האחרון יהיה ראשון וכן הלאה.`} />
      <PrimaryButton onClick={reverse} disabled={busy}>
        {busy ? <><Spinner /> הופך…</> : `הפוך סדר ${pageCount} דפים`}
      </PrimaryButton>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PDF → Word
// ─────────────────────────────────────────────────────────────
const ToWordPanel: React.FC = () => {
  const { pdfDoc, fileName } = usePDFStore()
  const { addToast } = useUIStore()
  const [busy, setBusy] = useState(false)
  const getEdited = useEditedBytes()

  if (!pdfDoc) return <EmptyHint />

  const convert = async () => {
    const outName = await askFileName(`${fileName.replace(/\.pdf$/i, '')}.docx`, '.docx')
    if (!outName) return
    setBusy(true)
    try {
      // Extract from the edited doc so page order matches what the user sees
      const edited = await loadEditedForRender(getEdited)
      const pages = await extractParagraphs(edited)
      edited.destroy()
      const total = pages.reduce((n, p) => n + p.length, 0)
      if (total === 0) {
        addToast('לא נמצא טקסט במסמך (ייתכן שהוא סרוק כתמונה)', 'warning')
        return
      }
      const docx = buildDocx(pages)
      triggerDownload(
        new Blob([docx.buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
        outName
      )
      addToast('קובץ Word ירד בהצלחה', 'success')
    } catch (e) { console.error(e); addToast('שגיאה בהמרה לוורד', 'error') } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InfoBar text="הטקסט מחולץ לקובץ DOCX הניתן לעריכה בוורד. עיצוב מורכב, טבלאות ותמונות לא נשמרים. מסמכים סרוקים (תמונה) — ללא טקסט לחילוץ." />
      <PrimaryButton onClick={convert} disabled={busy}>
        {busy ? <><Spinner /> ממיר…</> : 'המר ל-Word והורד'}
      </PrimaryButton>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Word → PDF
// ─────────────────────────────────────────────────────────────
const FromWordPanel: React.FC = () => {
  const { addToast } = useUIStore()
  const { loadPDF } = usePDF()
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  /**
   * Open-in-editor: every Word paragraph becomes a LIVE TextBox annotation
   * on blank pages — tap any paragraph to edit the words, drag to move,
   * restyle with the text tool. As close to editing the original Word
   * document as a PDF editor gets.
   */
  const convertToEditable = async () => {
    if (!file) return
    setBusy(true)
    try {
      const paras = parseDocx(new Uint8Array(await file.arrayBuffer()))
      if (!paras.some(p => p.text.trim() && p.text !== '\f')) {
        addToast('לא נמצא טקסט בקובץ', 'warning')
        return
      }
      const { pageCount, boxes } = layoutParagraphsToBoxes(paras)

      const doc = await PDFDocument.create()
      for (let i = 0; i < pageCount; i++) doc.addPage([595, 842])
      const saved = await doc.save()
      const name = file.name.replace(/\.docx?$/i, '') + '.pdf'
      const loaded = await loadPDF(saved.buffer as ArrayBuffer, { name })
      if (!loaded) return

      const { addAnnotation } = useAnnotationsStore.getState()
      boxes.forEach(b => {
        const tb: Omit<TextBoxAnnotation, 'id' | 'createdAt'> = {
          type: 'textbox',
          pageIndex: b.pageIndex,
          rect: { x: b.x, y: b.y, width: b.width, height: b.height },
          content: b.text,
          fontFamily: 'Heebo',
          fontSize: 12,
          fontWeight: 'normal',
          fontStyle: 'normal',
          textDecoration: 'none',
          color: '#111111',
          align: b.rtl ? 'right' : 'left',
          direction: b.rtl ? 'rtl' : 'ltr',
        }
        addAnnotation(tb)
      })
      useAnnotationsStore.getState().selectAnnotation(null)
      setFile(null)
      addToast('המסמך נפתח לעריכה — הקש על כל פסקה כדי לערוך אותה', 'success')
      window.location.hash = '#/editor'
    } catch (e: any) {
      console.error(e)
      const msg = e?.message === 'LEGACY_DOC'
        ? 'זהו קובץ .doc ישן — שמור אותו כ-DOCX בוורד ונסה שוב'
        : e?.message === 'NOT_DOCX'
        ? 'הקובץ אינו DOCX תקין'
        : 'שגיאה בהמרה מוורד — נסה לרענן את הדף'
      addToast(msg, 'error')
    } finally { setBusy(false) }
  }

  /** Download: rasterized pages (fixed layout, not editable). */
  const convertToDownload = async () => {
    if (!file) return
    setBusy(true)
    try {
      const paras = parseDocx(new Uint8Array(await file.arrayBuffer()))
      if (!paras.some(p => p.text.trim() && p.text !== '\f')) {
        addToast('לא נמצא טקסט בקובץ', 'warning')
        return
      }
      const pageImages = renderParagraphsToPages(paras)
      const doc = await PDFDocument.create()
      for (const dataUrl of pageImages) {
        const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0))
        const img = await doc.embedPng(bytes)
        const page = doc.addPage([595, 842])
        page.drawImage(img, { x: 0, y: 0, width: 595, height: 842 })
      }
      const saved = await doc.save()
      const defaultName = file.name.replace(/\.docx?$/i, '') + '.pdf'
      const outName = await askFileName(defaultName, '.pdf')
      if (outName) {
        downloadBlob(saved, outName)
        addToast('קובץ PDF ירד בהצלחה', 'success')
        setFile(null)
      }
    } catch (e: any) {
      console.error(e)
      const msg = e?.message === 'LEGACY_DOC'
        ? 'זהו קובץ .doc ישן — שמור אותו כ-DOCX בוורד ונסה שוב'
        : e?.message === 'NOT_DOCX'
        ? 'הקובץ אינו DOCX תקין'
        : 'שגיאה בהמרה מוורד — נסה לרענן את הדף'
      addToast(msg, 'error')
    } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InfoBar text="״פתח לעריכה״ הופך כל פסקה לטקסט חי בעורך — אפשר לערוך מילים, להזיז ולעצב, ממש כמו בוורד. ״הורד PDF״ מייצר קובץ סופי בפריסה קבועה." />
      <FilePicker accept=".docx" label="בחר קובץ Word" onPick={fs => setFile(fs[0] || null)} />
      {file && <FileRow name={file.name} size={file.size} onRemove={() => setFile(null)} />}
      <div style={{ display: 'flex', gap: 10 }}>
        <PrimaryButton onClick={convertToEditable} disabled={busy || !file}>
          {busy ? <><Spinner /> ממיר…</> : 'המר ופתח לעריכה'}
        </PrimaryButton>
        <GhostButton onClick={convertToDownload} disabled={busy || !file}>
          הורד PDF
        </GhostButton>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Page numbers
// ─────────────────────────────────────────────────────────────
const PageNumbersPanel: React.FC = () => {
  const { pdfDoc, pageNumbers, setPageNumbers } = usePDFStore()
  const { addToast } = useUIStore()
  const [position, setPosition] = useState<'center' | 'right' | 'left'>(pageNumbers?.position ?? 'center')
  const [startAt, setStartAt] = useState(String(pageNumbers?.startAt ?? 1))

  if (!pdfDoc) return <EmptyHint />

  const apply = () => {
    setPageNumbers({
      position,
      startAt: parseInt(startAt) || 1,
      dx: pageNumbers?.dx ?? 0,
      dy: pageNumbers?.dy ?? 0,
    })
    addToast(pageNumbers ? 'המספור עודכן' : 'המספור נוסף — גרור אותו על הדף למיקום מדויק', 'success')
  }

  const remove = () => {
    setPageNumbers(null)
    addToast('המספור הוסר', 'success')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InfoBar text="המספור מוצג כשכבה חיה: אפשר לגרור, לעדכן או להסיר בכל רגע. נטבע בקובץ רק בשמירה." />
      <SegmentedControl
        label="מיקום"
        value={position}
        options={[
          { value: 'center', label: 'מרכז' },
          { value: 'right', label: 'ימין' },
          { value: 'left', label: 'שמאל' },
        ]}
        onChange={v => setPosition(v as 'center' | 'right' | 'left')}
      />
      <div>
        <label className="label">התחל ממספר</label>
        <input
          className="input" value={startAt} onChange={e => setStartAt(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric" dir="ltr" style={{ width: '100%', textAlign: 'center' }}
        />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <PrimaryButton onClick={apply}>
          {pageNumbers ? 'עדכן מספור' : 'הוסף מספרי עמודים'}
        </PrimaryButton>
        {pageNumbers && (
          <GhostButton onClick={remove}>הסר</GhostButton>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Category icons
// ─────────────────────────────────────────────────────────────
function OrganizeIcon()   { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg> }
function WatermarkIcon()  { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 7l10 10M7 17L17 7" opacity="0.5"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg> }
function ReverseIcon()    { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16"/><path strokeLinecap="round" strokeLinejoin="round" d="M9 3l-5 4 5 4M15 13l5 4-5 4"/></svg> }
function WordIcon()       { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z"/><path strokeLinecap="round" strokeLinejoin="round" d="M8.5 12l1.5 5 2-4 2 4 1.5-5"/></svg> }
function FromWordIcon()   { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 11v6m0 0l-2.5-2.5M12 17l2.5-2.5"/></svg> }
function NumbersIcon()    { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path strokeLinecap="round" d="M12 17h.01M9 7h6M9 11h6"/></svg> }
function MergeIcon() { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 8V5a2 2 0 012-2h6a2 2 0 012 2v3M9 21h6a2 2 0 002-2v-3M12 8v8M8 12h8" /></svg> }
function SplitIcon() { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M4 11h16M6 11v8a2 2 0 002 2h2M18 11v8a2 2 0 01-2 2h-2" /></svg> }
function ExtractIcon() { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" /></svg> }
function CompressIcon() { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 9L4 4m0 0v4m0-4h4M15 9l5-5m0 0v4m0-4h-4M9 15l-5 5m0 0v-4m0 4h4M15 15l5 5m0 0v-4m0 4h-4" /></svg> }
function ImageIcon() { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 15l-5-5L5 21" /></svg> }
function FromImageIcon() { return <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 4h6a2 2 0 012 2v6M4 8V6a2 2 0 012-2h2M4 14v4a2 2 0 002 2h4" /></svg> }
