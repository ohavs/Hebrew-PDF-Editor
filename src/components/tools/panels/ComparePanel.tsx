import React, { useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocument, rgb } from 'pdf-lib'
import { usePDFStore, useUIStore } from '../../../store'
import { downloadBlob } from '../../../utils/pdfExport'
import { useEditedBytes } from '../../../hooks/usePageOps'
import { askFileName } from '../../ui/PromptDialog'
import { extractLines, diffLines, diffCanvases, type PageDiff } from '../../../utils/compare'
import {
  Spinner, EmptyHint, InfoBar, FilePicker, FileRow, PrimaryButton, GhostButton,
  renderPageCanvas, loadEditedForRender,
} from '../toolsShared'

const RENDER_SCALE = 1.5 // enough detail to spot a changed word, cheap enough for long documents

export const ComparePanel: React.FC = () => {
  const { pdfDoc, fileName } = usePDFStore()
  const { addToast } = useUIStore()
  const getEdited = useEditedBytes()
  const [other, setOther] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [diffs, setDiffs] = useState<PageDiff[] | null>(null)

  if (!pdfDoc) return <EmptyHint />

  const run = async () => {
    if (!other) return
    setBusy(true)
    setDiffs(null)
    try {
      const bytes = new Uint8Array(await other.arrayBuffer())
      const base = import.meta.env.BASE_URL || '/'
      const older = await pdfjsLib.getDocument({
        data: bytes.slice(),
        cMapUrl: `${base}cmaps/`, cMapPacked: true,
        standardFontDataUrl: `${base}standard_fonts/`,
        disableFontFace: true, useSystemFonts: false,
      }).promise
      // The current document as the user sees it, edits included
      const current = await loadEditedForRender(getEdited)

      const [oldLines, newLines] = await Promise.all([extractLines(older), extractLines(current)])
      const pageCount = Math.max(older.numPages, current.numPages)
      const result: PageDiff[] = []

      for (let i = 0; i < pageCount; i++) {
        const inOld = i < older.numPages
        const inNew = i < current.numPages
        if (!inOld || !inNew) {
          result.push({
            pageIndex: i,
            added: inNew ? newLines[i] : [],
            removed: inOld ? oldLines[i] : [],
            regions: [],
            onlyIn: inNew ? 'b' : 'a',
          })
          continue
        }

        const { added, removed } = diffLines(oldLines[i], newLines[i])
        const ca = await renderPageCanvas(older, i + 1, RENDER_SCALE)
        const cb = await renderPageCanvas(current, i + 1, RENDER_SCALE)
        const regions = diffCanvases(ca, cb, cb.width / RENDER_SCALE, cb.height / RENDER_SCALE)
        // Free the bitmaps straight away — a long document would otherwise
        // hold two full-resolution canvases per page
        ca.width = 0; cb.width = 0
        if (added.length || removed.length || regions.length) {
          result.push({ pageIndex: i, added, removed, regions, onlyIn: null })
        }
      }

      older.destroy()
      current.destroy()
      setDiffs(result)
      addToast(result.length ? `נמצאו הבדלים ב-${result.length} עמודים` : 'המסמכים זהים', result.length ? 'success' : 'info')
    } catch (e) {
      console.error(e)
      addToast('שגיאה בהשוואה — ודא ששני הקבצים תקינים', 'error')
    } finally { setBusy(false) }
  }

  /** The current document with every changed area boxed in red. */
  const downloadMarked = async () => {
    if (!diffs) return
    const outName = await askFileName(`${fileName.replace(/\.pdf$/i, '')}-השוואה.pdf`, '.pdf')
    if (!outName) return
    setBusy(true)
    try {
      const doc = await PDFDocument.load(await getEdited({ withDecorations: true }))
      const pages = doc.getPages()
      for (const d of diffs) {
        const page = pages[d.pageIndex]
        if (!page) continue
        const { height: H } = page.getSize()
        for (const r of d.regions) {
          page.drawRectangle({
            x: r.x,
            y: H - r.y - r.height, // display space is y-down, PDF space is y-up
            width: r.width,
            height: r.height,
            borderColor: rgb(0.86, 0.15, 0.15),
            borderWidth: 1.2,
            opacity: 0,
            borderOpacity: 0.9,
          })
        }
      }
      downloadBlob(await doc.save(), outName)
      addToast('הקובץ המסומן ירד', 'success')
    } catch (e) { console.error(e); addToast('שגיאה ביצירת הקובץ המסומן', 'error') } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InfoBar text="השווה את המסמך הפתוח מול גרסה אחרת. ההשוואה בודקת גם את הטקסט (אילו שורות נוספו או הוסרו) וגם את המראה — כדי לתפוס גם תמונות, חותמות ובלוקים שזזו." />
      <FilePicker accept=".pdf" label="בחר את הגרסה להשוואה" onPick={fs => { setOther(fs[0] || null); setDiffs(null) }} />
      {other && <FileRow name={other.name} size={other.size} onRemove={() => { setOther(null); setDiffs(null) }} />}

      <PrimaryButton onClick={run} disabled={busy || !other}>
        {busy ? <><Spinner /> משווה…</> : 'השווה'}
      </PrimaryButton>

      {diffs && diffs.length === 0 && (
        <div style={{
          padding: '14px 16px', borderRadius: 12, textAlign: 'center',
          background: 'var(--color-surface-2)', color: 'var(--color-text-muted)', fontSize: 13,
        }}>
          לא נמצאו הבדלים בין המסמכים
        </div>
      )}

      {diffs && diffs.length > 0 && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {diffs.map(d => <DiffCard key={d.pageIndex} diff={d} />)}
          </div>
          <GhostButton onClick={downloadMarked} disabled={busy}>
            הורד PDF עם סימון ההבדלים
          </GhostButton>
        </>
      )}
    </div>
  )
}

const DiffCard: React.FC<{ diff: PageDiff }> = ({ diff }) => (
  <div style={{
    border: '1px solid var(--color-border)', borderRadius: 12,
    padding: '10px 12px', background: 'var(--color-surface)',
  }} data-diff-page={diff.pageIndex + 1}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 12.5, fontWeight: 700 }}>עמוד {diff.pageIndex + 1}</span>
      {diff.onlyIn && (
        <span style={{
          fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
          background: diff.onlyIn === 'b' ? 'rgba(22,163,74,0.14)' : 'rgba(220,38,38,0.12)',
          color: diff.onlyIn === 'b' ? '#16a34a' : '#dc2626',
        }}>
          {diff.onlyIn === 'b' ? 'עמוד חדש' : 'עמוד שהוסר'}
        </span>
      )}
      {!diff.onlyIn && diff.regions.length > 0 && (
        <span style={{ fontSize: 10.5, color: 'var(--color-text-muted)' }}>
          {diff.regions.length} אזורים השתנו
        </span>
      )}
    </div>

    {diff.removed.length > 0 && (
      <DiffLines lines={diff.removed} sign="−" color="#dc2626" background="rgba(220,38,38,0.07)" />
    )}
    {diff.added.length > 0 && (
      <DiffLines lines={diff.added} sign="+" color="#16a34a" background="rgba(22,163,74,0.08)" />
    )}
    {!diff.added.length && !diff.removed.length && (
      <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
        הטקסט זהה — ההבדל הוא בפריסה או בגרפיקה
      </div>
    )}
  </div>
)

const DiffLines: React.FC<{ lines: string[]; sign: string; color: string; background: string }> = ({ lines, sign, color, background }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 4 }}>
    {lines.slice(0, 8).map((line, i) => (
      <div key={i} style={{
        display: 'flex', gap: 6, fontSize: 11.5, lineHeight: 1.45,
        padding: '3px 7px', borderRadius: 7, background,
      }}>
        <span style={{ color, fontWeight: 700, flexShrink: 0 }}>{sign}</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{line}</span>
      </div>
    ))}
    {lines.length > 8 && (
      <div style={{ fontSize: 10.5, color: 'var(--color-text-muted)', paddingInlineStart: 7 }}>
        ועוד {lines.length - 8} שורות
      </div>
    )}
  </div>
)
