import React, { useMemo, useRef, useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { useUIStore } from '../../../store'
import { usePDF } from '../../../hooks/usePDF'
import { downloadBlob } from '../../../utils/pdfExport'
import { askFileName } from '../../ui/PromptDialog'
import {
  parseFlipbookUrl, fetchFlipbookPages, BlockedByBrowser, type FlipbookPage,
} from '../../../utils/flipbookFetch'
import { InfoBar, PrimaryButton, GhostButton, Spinner, FileRow } from '../toolsShared'

/** page2 before page10 — the whole reason this is not just "images to PDF". */
const naturally = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

/**
 * Flipbook → PDF.
 *
 * The pages of an HTML5 flipbook cannot be fetched from here: a browser will
 * not read another site's images without its permission, and this app has no
 * server to fetch on its behalf. What it does instead is take the page images
 * once they are on the device — saved from the flipbook, or exported by it —
 * and rebuild the publication in the right order, which is the part that is
 * tedious by hand.
 */
export const FlipbookPanel: React.FC = () => {
  const { addToast } = useUIStore()
  const { loadPDF } = usePDF()
  const [files, setFiles] = useState<File[]>([])
  const [fetched, setFetched] = useState<FlipbookPage[]>([])
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [blocked, setBlocked] = useState(false)
  const filesRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)

  /**
   * Fetch the publication's pages straight from its address.
   *
   * Whether this is permitted is the other site's decision, not ours: a
   * browser hands a script another site's bytes only when that site allows it,
   * and this app has no server to fetch on its behalf. A refusal is reported
   * as what it is, with the way round it.
   */
  const pull = async () => {
    const src = parseFlipbookUrl(url)
    if (!src) {
      addToast('הכתובת לא נראית כמו פרסום של FlipHTML5', 'warning')
      return
    }
    setBusy(true)
    setBlocked(false)
    setFetched([])
    try {
      const pages = await fetchFlipbookPages(src, (done, total) =>
        setProgress(total ? `מוריד עמוד ${done} מתוך ${total}` : `מוריד עמוד ${done}`))
      if (!pages.length) {
        addToast('לא נמצאו עמודים בכתובת הזו', 'warning')
        return
      }
      setFetched(pages)
      addToast(`התקבלו ${pages.length} עמודים`, 'success')
    } catch (e) {
      if (e instanceof BlockedByBrowser) {
        setBlocked(true)
      } else {
        console.error(e)
        addToast('שגיאה בהבאת העמודים', 'error')
      }
    } finally { setBusy(false); setProgress('') }
  }

  const ordered = useMemo(
    () => [...files].sort((a, b) => naturally.compare(a.name, b.name)),
    [files])

  const accept = (list: FileList | null) => {
    const picked = Array.from(list || []).filter(f => f.type.startsWith('image/'))
    if (!picked.length) { addToast('לא נמצאו תמונות בבחירה', 'warning'); return }
    setFiles(prev => [...prev, ...picked])
  }

  /** Pages to bind: whatever was fetched, else whatever was picked. */
  const sources: Array<{ bytes: () => Promise<Uint8Array>; png: boolean }> = fetched.length
    ? fetched.map(p => ({ bytes: async () => p.bytes, png: p.kind === 'png' }))
    : ordered.map(f => ({
      bytes: async () => new Uint8Array(await f.arrayBuffer()),
      png: /\.png$/i.test(f.name) || f.type.includes('png'),
    }))

  const build = async (): Promise<Uint8Array> => {
    const doc = await PDFDocument.create()
    for (const [i, source] of sources.entries()) {
      setProgress(`עמוד ${i + 1} מתוך ${sources.length}`)
      const bytes = await source.bytes()
      const img = source.png ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
      const page = doc.addPage([img.width, img.height])
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height })
    }
    return doc.save()
  }

  const run = async (then: 'download' | 'open') => {
    if (!sources.length) return
    setBusy(true)
    try {
      const bytes = await build()
      if (then === 'open') {
        await loadPDF(bytes.buffer as ArrayBuffer, { name: 'פליפבוק.pdf' })
        setFiles([])
        setFetched([])
        window.location.hash = '#/editor'
        return
      }
      const outName = await askFileName('פליפבוק.pdf', '.pdf')
      if (!outName) return
      downloadBlob(bytes, outName)
      addToast(`נוצר PDF מ-${sources.length} עמודים`, 'success')
      setFiles([])
      setFetched([])
    } catch (e) {
      console.error(e)
      addToast('שגיאה ביצירת ה-PDF', 'error')
    } finally { setBusy(false); setProgress('') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InfoBar text="הדבק כתובת של פרסום ב-FlipHTML5, או בחר את תמונות העמודים מהמחשב. הסדר נקבע לפי מספרי הקבצים, כך שעמוד 2 בא לפני עמוד 10." />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ fontSize: 12, fontWeight: 600 }}>כתובת הפליפבוק</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="url"
            dir="ltr"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') pull() }}
            placeholder="https://fliphtml5.com/xxxx/yyyy/"
            style={{
              flex: 1, minWidth: 0, padding: '9px 11px', borderRadius: 10,
              border: '1px solid var(--color-border)', fontFamily: 'inherit',
              fontSize: 13, background: 'var(--color-surface)', color: 'var(--color-text)',
            }}
          />
          <GhostButton onClick={pull} disabled={busy || !url.trim()}>
            {busy && progress ? <><Spinner /> {progress}</> : 'הבא עמודים'}
          </GhostButton>
        </div>
      </div>

      {blocked && (
        <div style={{
          fontSize: 12, lineHeight: 1.6, padding: '10px 12px', borderRadius: 10,
          background: 'var(--color-mint)', color: 'var(--color-ink-black)',
        }}>
          האתר של הפליפבוק לא מרשה לדפדפן למשוך ממנו את התמונות (מדיניות אבטחה של
          הדפדפן, לא תקלה כאן). האפליקציה פועלת כולה במכשיר שלך ואין לה שרת שיביא
          את הקבצים במקומך. הדרך שעובדת: לשמור את עמודי הפליפבוק כתמונות ולבחור
          אותם כאן למטה.
        </div>
      )}

      {fetched.length > 0 && (
        <div style={{ fontSize: 12, fontWeight: 600 }}>
          {fetched.length} עמודים התקבלו מהכתובת
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <GhostButton onClick={() => filesRef.current?.click()}>בחר תמונות</GhostButton>
        <GhostButton onClick={() => folderRef.current?.click()}>בחר תיקייה</GhostButton>
      </div>

      <input
        ref={filesRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
        onChange={e => { accept(e.target.files); e.target.value = '' }}
      />
      <input
        ref={folderRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
        // Non-standard but supported everywhere that matters; a flipbook export
        // is a folder of numbered images
        {...{ webkitdirectory: '', directory: '' } as any}
        onChange={e => { accept(e.target.files); e.target.value = '' }}
      />

      {ordered.length > 0 && (
        <>
          <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
            {ordered.length} עמודים · לפי סדר השמות
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
            {ordered.map((f, i) => (
              <FileRow
                key={`${f.name}-${i}`}
                name={`${i + 1}. ${f.name}`}
                size={f.size}
                onRemove={() => setFiles(prev => prev.filter(x => x !== f))}
              />
            ))}
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <PrimaryButton onClick={() => run('download')} disabled={busy || !sources.length}>
          {busy ? <><Spinner /> {progress || 'בונה…'}</> : 'צור PDF והורד'}
        </PrimaryButton>
        <GhostButton onClick={() => run('open')} disabled={busy || !sources.length}>
          פתח בעורך
        </GhostButton>
      </div>
    </div>
  )
}
