import React, { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import { usePDFStore, useUIStore } from '../../store'
import { usePDF } from '../../hooks/usePDF'
import { downloadBlob, triggerDownload } from '../../utils/pdfExport'
import { useEditedBytes, usePageOps } from '../../hooks/usePageOps'
import { PageListPanel } from '../panels/PageListPanel'

const EASE = 'cubic-bezier(0.23,1,0.32,1)'

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', borderBottom: '1px solid var(--color-border)', flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-ink-black)' }}>כלי PDF</span>
        <button onClick={onClose} style={{
          width: 26, height: 26, borderRadius: 7, border: 'none', cursor: 'pointer',
          background: 'var(--color-surface-2)', color: 'var(--color-text)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Category pills — wrap so every tool is always visible (a hidden
          horizontal scroll was unusable with a mouse) */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 10px',
        borderBottom: '1px solid var(--color-border)', flexShrink: 0,
      }}>
        {CATEGORIES.map(cat => {
          const isActive = active === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => setActive(cat.id)}
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

      {/* Content area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        <ToolPanel category={active} />
      </div>
    </div>
  )
}

// Keep the outer PDFToolsModal as a no-op since LeftPanel handles it now
export const PDFToolsModal: React.FC = () => null

// ─────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────
async function renderPageCanvas(pdfDoc: any, pageNum: number, scale: number): Promise<HTMLCanvasElement> {
  const page = await pdfDoc.getPage(pageNum)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport }).promise
  page.cleanup()
  return canvas
}

/** Load the EDITED document (annotations + order + rotation baked) into pdf.js
 *  so raster exports (compress, to-image) include everything the user sees. */
async function loadEditedForRender(getEdited: (o?: { withDecorations?: boolean }) => Promise<Uint8Array>): Promise<any> {
  const bytes = await getEdited({ withDecorations: true })
  const base = import.meta.env.BASE_URL || '/'
  return pdfjsLib.getDocument({
    data: bytes,
    cMapUrl: `${base}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${base}standard_fonts/`,
    disableFontFace: true,
    useSystemFonts: false,
  }).promise
}

function parseRanges(input: string, max: number): number[] {
  const result = new Set<number>()
  input.split(',').forEach(part => {
    const p = part.trim()
    if (!p) return
    const m = p.match(/^(\d+)\s*-\s*(\d+)$/)
    if (m) {
      const a = parseInt(m[1]), b = parseInt(m[2])
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) if (i >= 1 && i <= max) result.add(i)
    } else {
      const n = parseInt(p)
      if (n >= 1 && n <= max) result.add(n)
    }
  })
  return [...result].sort((a, b) => a - b)
}

const Spinner = () => (
  <svg className="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" />
  </svg>
)

// ─────────────────────────────────────────────────────────────
// Panel router
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
const MergePanel: React.FC = () => {
  const { pdfDoc, fileName } = usePDFStore()
  const { addToast, mergeItems, setMergeItems } = useUIStore()
  const { loadPDF } = usePDF()
  const [busy, setBusy] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragDy, setDragDy] = useState(0)
  const dragDyRef = React.useRef(0)
  const getEdited = useEditedBytes()

  const ROW = 56

  // Drop stale "current document" entries; seed one when a doc is open
  React.useEffect(() => {
    const items = useUIStore.getState().mergeItems
    const cleaned = pdfDoc ? items : items.filter(i => i.kind !== 'current')
    if (pdfDoc && !cleaned.some(i => i.kind === 'current') && cleaned.length === 0) {
      setMergeItems([{ id: 'current', kind: 'current' }])
    } else if (cleaned.length !== items.length) {
      setMergeItems(cleaned)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc])

  const items = pdfDoc ? mergeItems : mergeItems.filter(i => i.kind !== 'current')

  const addFiles = (fs: File[]) => {
    const newItems = fs.map(f => ({ id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 7)}`, kind: 'file' as const, file: f }))
    setMergeItems([...items, ...newItems])
  }

  const removeItem = (id: string) => setMergeItems(items.filter(i => i.id !== id))

  const dragTarget = dragIdx === null ? null
    : Math.max(0, Math.min(items.length - 1, dragIdx + Math.round(dragDy / ROW)))

  const startRowDrag = (e: React.PointerEvent, idx: number) => {
    e.preventDefault(); e.stopPropagation()
    const el = e.currentTarget as HTMLElement
    const pid = e.pointerId
    const startY = e.clientY
    try { el.setPointerCapture(pid) } catch { /* ignore */ }
    setDragIdx(idx); setDragDy(0); dragDyRef.current = 0
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return
      ev.preventDefault()
      dragDyRef.current = ev.clientY - startY
      setDragDy(dragDyRef.current)
    }
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      const cur = useUIStore.getState().mergeItems
      const target = Math.max(0, Math.min(cur.length - 1, idx + Math.round(dragDyRef.current / ROW)))
      if (target !== idx) {
        const next = [...cur]
        const [moved] = next.splice(idx, 1)
        next.splice(target, 0, moved)
        setMergeItems(next)
      }
      setDragIdx(null); setDragDy(0)
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
  }

  const buildMerged = async (): Promise<{ bytes: Uint8Array; name: string }> => {
    const out = await PDFDocument.create()
    for (const item of items) {
      const srcBytes = item.kind === 'current'
        ? await getEdited({ withDecorations: true })
        : new Uint8Array(await item.file.arrayBuffer())
      const doc = await PDFDocument.load(srcBytes, { ignoreEncryption: true })
      const pages = await out.copyPages(doc, doc.getPageIndices())
      pages.forEach(p => out.addPage(p))
    }
    const first = items[0]
    const baseName = first?.kind === 'current'
      ? fileName.replace(/\.pdf$/i, '')
      : (first?.kind === 'file' ? first.file.name.replace(/\.pdf$/i, '') : 'merged')
    return { bytes: await out.save(), name: `${baseName}-ממוזג.pdf` }
  }

  const mergeAndDownload = async () => {
    setBusy(true)
    try {
      const { bytes, name } = await buildMerged()
      downloadBlob(bytes, name)
      addToast('הקובץ הממוזג ירד בהצלחה', 'success')
    } catch (e) { console.error(e); addToast('שגיאה במיזוג', 'error') } finally { setBusy(false) }
  }

  const mergeAndOpen = async () => {
    setBusy(true)
    try {
      const { bytes, name } = await buildMerged()
      await loadPDF(bytes.buffer as ArrayBuffer, { name })
      setMergeItems([])
      addToast('הקובץ הממוזג נפתח בעורך', 'success')
    } catch (e) { console.error(e); addToast('שגיאה במיזוג', 'error') } finally { setBusy(false) }
  }

  const fileCount = items.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <InfoBar text="הוסף קבצי PDF, גרור מהידית לשינוי הסדר, ואז הורד או פתח בעורך. הרשימה נשמרת גם אם תעבור לכלי אחר." />
      <FilePicker accept=".pdf" multiple label="הוסף קבצי PDF" onPick={addFiles} />

      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((item, i) => {
            const isDragging = dragIdx === i
            let shift = 0
            if (dragIdx !== null && dragTarget !== null && !isDragging) {
              if (dragIdx < dragTarget && i > dragIdx && i <= dragTarget) shift = -ROW
              else if (dragIdx > dragTarget && i >= dragTarget && i < dragIdx) shift = ROW
            }
            return (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                height: ROW - 6, padding: '0 8px', borderRadius: 12,
                background: item.kind === 'current' ? 'var(--color-mint)' : 'var(--color-surface-2)',
                transform: isDragging ? `translateY(${dragDy}px) scale(1.02)` : `translateY(${shift}px)`,
                transition: isDragging ? 'none' : 'transform 180ms cubic-bezier(0.23,1,0.32,1)',
                zIndex: isDragging ? 10 : 1, position: 'relative',
                boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.2)' : 'none',
              }}>
                <div
                  onPointerDown={e => startRowDrag(e, i)}
                  style={{
                    width: 34, height: '100%', flexShrink: 0, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    cursor: 'grab', touchAction: 'none', color: 'var(--color-text-muted)',
                  }}
                  aria-label="גרור לשינוי סדר"
                >
                  <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/>
                    <circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/>
                    <circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/>
                  </svg>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', width: 16, textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.kind === 'current' ? `המסמך הפתוח (${fileName})` : item.file.name}
                  </div>
                  {item.kind === 'file' && (
                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{(item.file.size / 1024 / 1024).toFixed(1)}MB</div>
                  )}
                </div>
                <button
                  aria-label="הסר"
                  onClick={() => removeItem(item.id)}
                  style={{
                    width: 30, height: 30, borderRadius: '50%', border: 'none', flexShrink: 0,
                    background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    minHeight: 0, padding: 0,
                  }}
                >
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            )
          })}
        </div>
      )}

      {fileCount < 2 && (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
          הוסף לפחות שני קבצים למיזוג
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <PrimaryButton onClick={mergeAndDownload} disabled={busy || fileCount < 2}>
          {busy ? <><Spinner /> ממזג…</> : 'מזג והורד'}
        </PrimaryButton>
        <GhostButton onClick={mergeAndOpen} disabled={busy || fileCount < 2}>
          מזג ופתח בעורך
        </GhostButton>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Split
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
    setBusy(true)
    try {
      const src = await PDFDocument.load(await getEdited({ withDecorations: true }))
      const dest = await PDFDocument.create()
      const copied = await dest.copyPages(src, pages.map(p => p - 1))
      copied.forEach(p => dest.addPage(p))
      downloadBlob(await dest.save(), `${fileName.replace(/\.pdf$/i, '')}-חילוץ.pdf`)
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
      downloadBlob(saved, `${fileName.replace(/\.pdf$/i, '')}-דחוס.pdf`)
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
const EmptyHint: React.FC = () => (
  <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-muted)' }}>
    <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>פתח קובץ PDF כדי להשתמש בכלי זה</div>
  </div>
)

const InfoBar: React.FC<{ text: string }> = ({ text }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
    background: 'var(--color-surface-2)', borderRadius: 12, fontSize: 13,
    color: 'var(--color-text-muted)', lineHeight: 1.5,
  }}>
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <span>{text}</span>
  </div>
)

const FilePicker: React.FC<{ accept: string; multiple?: boolean; label: string; onPick: (files: File[]) => void }> =
  ({ accept, multiple, label, onPick }) => {
    const ref = React.useRef<HTMLInputElement>(null)
    const [drag, setDrag] = useState(false)
    return (
      <div
        onClick={() => ref.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => {
          e.preventDefault(); setDrag(false)
          const fs = Array.from(e.dataTransfer.files).filter(f => accept.split(',').some(a => f.type === a || f.name.endsWith(a.replace('.', ''))))
          if (fs.length) onPick(fs)
        }}
        style={{
          border: `2px dashed ${drag ? 'var(--color-ink-black)' : 'var(--color-border)'}`,
          borderRadius: 16, padding: '28px 20px', textAlign: 'center', cursor: 'pointer',
          background: drag ? 'var(--color-mint)' : 'var(--color-surface)',
          transition: `border-color 180ms ${EASE}, background 180ms ease-out`,
        }}
      >
        <input ref={ref} type="file" accept={accept} multiple={multiple} style={{ display: 'none' }}
          onChange={e => { const fs = Array.from(e.target.files || []); if (fs.length) onPick(fs); e.target.value = '' }} />
        <div style={{ fontSize: 28, marginBottom: 6 }}>⬆️</div>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text)' }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>או גרור לכאן</div>
      </div>
    )
  }

const FileRow: React.FC<{ name: string; size: number; onRemove: () => void }> = ({ name, size, onRemove }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
    background: 'var(--color-surface-2)', borderRadius: 10, border: '1px solid var(--color-border)',
  }}>
    <span style={{ fontSize: 18 }}>📄</span>
    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'start' }}>{name}</span>
    <span style={{ fontSize: 12, color: 'var(--color-text-muted)', flexShrink: 0 }}>{(size / 1024).toFixed(0)} KB</span>
    <button onClick={onRemove} style={{
      width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(239,68,68,0.15)', color: '#ef4444',
      cursor: 'pointer', flexShrink: 0, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>×</button>
  </div>
)

const SegmentedControl: React.FC<{ label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }> =
  ({ label, value, options, onChange }) => (
    <div>
      <label className="label">{label}</label>
      <div style={{ display: 'flex', gap: 4, background: 'var(--color-surface-2)', padding: 4, borderRadius: 12 }}>
        {options.map(opt => (
          <button key={opt.value} onClick={() => onChange(opt.value)}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              background: value === opt.value ? 'var(--color-surface)' : 'transparent',
              color: value === opt.value ? 'var(--color-ink-black)' : 'var(--color-text-muted)',
              boxShadow: value === opt.value ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: `background 150ms ease-out, color 150ms ease-out`,
            }}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )

const PrimaryButton: React.FC<{ onClick: () => void; disabled?: boolean; children: React.ReactNode }> = ({ onClick, disabled, children }) => (
  <button onClick={onClick} disabled={disabled}
    style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      padding: '13px 20px', borderRadius: 13, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
      background: 'var(--color-accent)', color: 'var(--color-on-accent)', fontSize: 14.5, fontWeight: 600,
      fontFamily: 'inherit', opacity: disabled ? 0.5 : 1, flex: 1,
      transition: `transform 150ms ${EASE}, filter 150ms ease-out`,
    }}
    onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.2)' }}
    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = '' }}
    onMouseDown={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)' }}
    onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
  >
    {children}
  </button>
)

const GhostButton: React.FC<{ onClick: () => void; disabled?: boolean; children: React.ReactNode }> = ({ onClick, disabled, children }) => (
  <button onClick={onClick} disabled={disabled}
    style={{
      padding: '13px 20px', borderRadius: 13, cursor: disabled ? 'not-allowed' : 'pointer',
      background: 'var(--color-surface-2)', color: 'var(--color-text)', fontSize: 14, fontWeight: 600,
      fontFamily: 'inherit', border: '1px solid var(--color-border)', opacity: disabled ? 0.5 : 1, flexShrink: 0,
      transition: `transform 150ms ${EASE}, background 150ms ease-out`,
    }}
    onMouseDown={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)' }}
    onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
  >
    {children}
  </button>
)

// ─────────────────────────────────────────────────────────────
// Watermark
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
    setBusy(true)
    try {
      const { extractParagraphs, buildDocx } = await import('../../utils/wordConvert')
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
        `${fileName.replace(/\.pdf$/i, '')}.docx`
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

  const convert = async (mode: 'download' | 'edit') => {
    if (!file) return
    setBusy(true)
    try {
      const { parseDocx, renderParagraphsToPages } = await import('../../utils/wordConvert')
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
      const outName = file.name.replace(/\.docx?$/i, '') + '.pdf'
      if (mode === 'edit') {
        await loadPDF(saved.buffer as ArrayBuffer, { name: outName })
        addToast('הקובץ הומר ונפתח בעורך', 'success')
      } else {
        downloadBlob(saved, outName)
        addToast('קובץ PDF ירד בהצלחה', 'success')
      }
      setFile(null)
    } catch (e) { console.error(e); addToast('שגיאה בהמרה מוורד', 'error') } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InfoBar text="בחר קובץ Word ‏(DOCX). הטקסט מומר לדפי PDF בפריסת A4 — תמונות ועיצוב מורכב לא נשמרים." />
      <FilePicker accept=".docx" label="בחר קובץ Word" onPick={fs => setFile(fs[0] || null)} />
      {file && <FileRow name={file.name} size={file.size} onRemove={() => setFile(null)} />}
      <div style={{ display: 'flex', gap: 10 }}>
        <PrimaryButton onClick={() => convert('download')} disabled={busy || !file}>
          {busy ? <><Spinner /> ממיר…</> : 'המר והורד PDF'}
        </PrimaryButton>
        <GhostButton onClick={() => convert('edit')} disabled={busy || !file}>
          פתח בעורך
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
