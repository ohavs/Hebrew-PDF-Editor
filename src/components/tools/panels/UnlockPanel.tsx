import React, { useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocument } from 'pdf-lib'
import { useUIStore } from '../../../store'
import { usePDF } from '../../../hooks/usePDF'
import { downloadBlob } from '../../../utils/pdfExport'
import { askFileName } from '../../ui/PromptDialog'
import {
  Spinner, InfoBar, FilePicker, FileRow, PrimaryButton, GhostButton, renderPageCanvas,
} from '../toolsShared'

/** High enough that print output still looks sharp. */
const RENDER_SCALE = 2

type Status = { kind: 'idle' | 'needs-password' | 'wrong-password' }

export const UnlockPanel: React.FC = () => {
  const { addToast } = useUIStore()
  const { loadPDF } = usePDF()
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  /** Open with pdf.js — the only part of the stack that can decrypt. */
  const openDecrypted = async (bytes: Uint8Array) => {
    const base = import.meta.env.BASE_URL || '/'
    return pdfjsLib.getDocument({
      data: bytes,
      password: password || undefined,
      cMapUrl: `${base}cmaps/`, cMapPacked: true,
      standardFontDataUrl: `${base}standard_fonts/`,
      disableFontFace: true, useSystemFonts: false,
    }).promise
  }

  /**
   * Rebuild the document from its rendered pages.
   *
   * pdf.js decrypts on the way in, but nothing in the browser can re-emit the
   * original streams without their encryption, so the unlocked copy is built
   * from what the pages actually draw. Layout and appearance are exact; the
   * text becomes part of the image, as with the compress tool.
   */
  const unlock = async (then: 'download' | 'open') => {
    if (!file) return
    setBusy(true)
    setStatus({ kind: 'idle' })
    try {
      const src = await openDecrypted(new Uint8Array(await file.arrayBuffer()))
      const out = await PDFDocument.create()
      for (let i = 1; i <= src.numPages; i++) {
        setProgress(`עמוד ${i} מתוך ${src.numPages}`)
        const canvas = await renderPageCanvas(src, i, RENDER_SCALE)
        const jpeg = canvas.toDataURL('image/jpeg', 0.92)
        const img = await out.embedJpg(Uint8Array.from(atob(jpeg.split(',')[1]), c => c.charCodeAt(0)))
        const page = out.addPage([canvas.width / RENDER_SCALE, canvas.height / RENDER_SCALE])
        page.drawImage(img, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() })
        canvas.width = 0
      }
      src.destroy()
      const saved = await out.save()

      const baseName = file.name.replace(/\.pdf$/i, '')
      if (then === 'open') {
        await loadPDF(saved.buffer as ArrayBuffer, { name: `${baseName}-ללא-הגנה.pdf` })
        setFile(null)
        setPassword('')
        window.location.hash = '#/editor'
        return
      }
      const outName = await askFileName(`${baseName}-ללא-הגנה.pdf`, '.pdf')
      if (!outName) return
      downloadBlob(saved, outName)
      addToast('הקובץ נשמר ללא הגנה', 'success')
      setFile(null)
      setPassword('')
    } catch (e: any) {
      console.error(e)
      // pdf.js reports a missing password and a wrong one separately
      if (e?.name === 'PasswordException') {
        // The message belongs next to the field it is about, not floating over
        // the page — the input already says what is wrong and where to fix it
        const wrong = e?.code === 2 || /incorrect/i.test(String(e?.message))
        setStatus({ kind: wrong ? 'wrong-password' : 'needs-password' })
        document.getElementById('unlock-password')?.focus()
      } else {
        addToast('שגיאה בהסרת ההגנה', 'error')
      }
    } finally { setBusy(false); setProgress('') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InfoBar text="מסיר סיסמה והגבלות (הדפסה, העתקה) מקובץ שיש לך גישה אליו. הקובץ נבנה מחדש מהעמודים כפי שהם מוצגים — המראה נשמר במדויק, אך הטקסט הופך לחלק מהתמונה ולא יהיה ניתן לחיפוש." />

      <FilePicker accept=".pdf" label="בחר קובץ מוגן" onPick={fs => { setFile(fs[0] || null); setStatus({ kind: 'idle' }) }} />
      {file && <FileRow name={file.name} size={file.size} onRemove={() => { setFile(null); setPassword(''); setStatus({ kind: 'idle' }) }} />}

      <div>
        <label className="label" htmlFor="unlock-password">סיסמה (אם הקובץ דורש אותה)</label>
        <input
          id="unlock-password"
          className="input"
          type="password"
          value={password}
          onChange={e => { setPassword(e.target.value); setStatus({ kind: 'idle' }) }}
          placeholder="השאר ריק אם הקובץ נפתח ללא סיסמה"
          dir="ltr"
          style={{ width: '100%', textAlign: 'center' }}
        />
        {status.kind !== 'idle' && (
          <div role="alert" style={{ fontSize: 11.5, color: '#dc2626', marginTop: 5 }}>
            {status.kind === 'wrong-password'
              ? 'הסיסמה שגויה — נסה שוב'
              : 'הקובץ מוגן בסיסמה. הזן אותה כדי להמשיך'}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <PrimaryButton onClick={() => unlock('download')} disabled={busy || !file}>
          {busy ? <><Spinner /> {progress || 'מסיר הגנה…'}</> : 'הסר הגנה והורד'}
        </PrimaryButton>
        <GhostButton onClick={() => unlock('open')} disabled={busy || !file}>
          פתח בעורך
        </GhostButton>
      </div>
    </div>
  )
}
