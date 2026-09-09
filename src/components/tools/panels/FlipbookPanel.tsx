import React, { useMemo, useRef, useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { useUIStore } from '../../../store'
import { usePDF } from '../../../hooks/usePDF'
import { downloadBlob } from '../../../utils/pdfExport'
import { askFileName } from '../../ui/PromptDialog'
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
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const filesRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)

  const ordered = useMemo(
    () => [...files].sort((a, b) => naturally.compare(a.name, b.name)),
    [files])

  const accept = (list: FileList | null) => {
    const picked = Array.from(list || []).filter(f => f.type.startsWith('image/'))
    if (!picked.length) { addToast('לא נמצאו תמונות בבחירה', 'warning'); return }
    setFiles(prev => [...prev, ...picked])
  }

  const build = async (): Promise<Uint8Array> => {
    const doc = await PDFDocument.create()
    for (const [i, file] of ordered.entries()) {
      setProgress(`עמוד ${i + 1} מתוך ${ordered.length}`)
      const bytes = new Uint8Array(await file.arrayBuffer())
      const img = /\.png$/i.test(file.name) || file.type.includes('png')
        ? await doc.embedPng(bytes)
        : await doc.embedJpg(bytes)
      const page = doc.addPage([img.width, img.height])
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height })
    }
    return doc.save()
  }

  const run = async (then: 'download' | 'open') => {
    if (!ordered.length) return
    setBusy(true)
    try {
      const bytes = await build()
      if (then === 'open') {
        await loadPDF(bytes.buffer as ArrayBuffer, { name: 'פליפבוק.pdf' })
        setFiles([])
        window.location.hash = '#/editor'
        return
      }
      const outName = await askFileName('פליפבוק.pdf', '.pdf')
      if (!outName) return
      downloadBlob(bytes, outName)
      addToast(`נוצר PDF מ-${ordered.length} עמודים`, 'success')
      setFiles([])
    } catch (e) {
      console.error(e)
      addToast('שגיאה ביצירת ה-PDF', 'error')
    } finally { setBusy(false); setProgress('') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InfoBar text="בחר את תמונות העמודים של הפליפבוק — קובץ אחד לכל עמוד, או תיקייה שלמה. הסדר נקבע לפי מספרי הקבצים, כך שעמוד 2 בא לפני עמוד 10. שים לב: הדפדפן לא יכול למשוך עמודים מכתובת של אתר אחר, לכן יש להוריד או לשמור את התמונות קודם." />

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
        <PrimaryButton onClick={() => run('download')} disabled={busy || !ordered.length}>
          {busy ? <><Spinner /> {progress || 'בונה…'}</> : 'צור PDF והורד'}
        </PrimaryButton>
        <GhostButton onClick={() => run('open')} disabled={busy || !ordered.length}>
          פתח בעורך
        </GhostButton>
      </div>
    </div>
  )
}
