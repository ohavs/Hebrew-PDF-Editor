import React, { useState, useRef, useCallback } from 'react'
import { PDFDocument } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import { ConverterLayout } from './ConverterLayout'
import { DropZone } from './PDFToImage'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

export const CompressPDF: React.FC = () => {
  const [file, setFile] = useState<File | null>(null)
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('medium')
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<{ bytes: Uint8Array; size: number } | null>(null)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Scale map per quality
  const scaleMap = { low: 0.5, medium: 0.75, high: 0.9 }
  const jpegMap = { low: 60, medium: 78, high: 90 }

  const compress = useCallback(async () => {
    if (!file) return
    setProcessing(true); setError(''); setResult(null)
    try {
      const originalBytes = new Uint8Array(await file.arrayBuffer())
      const scale = scaleMap[quality]
      const jpegQ = jpegMap[quality]

      // Re-render each page at lower resolution, embed as JPEG
      const pdfIn = await pdfjsLib.getDocument({
        data: originalBytes.slice(),
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/cmaps/',
        cMapPacked: true,
      }).promise

      const pdfOut = await PDFDocument.create()

      for (let i = 1; i <= pdfIn.numPages; i++) {
        const page = await pdfIn.getPage(i)
        const vp = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        canvas.width = vp.width; canvas.height = vp.height
        const ctx = canvas.getContext('2d')!
        await page.render({ canvasContext: ctx, viewport: vp, canvas } as any).promise
        const jpegDataUrl = canvas.toDataURL('image/jpeg', jpegQ / 100)
        const jpegBytes = Uint8Array.from(atob(jpegDataUrl.split(',')[1]), c => c.charCodeAt(0))
        const img = await pdfOut.embedJpg(jpegBytes)
        const outPage = pdfOut.addPage([vp.width, vp.height])
        outPage.drawImage(img, { x: 0, y: 0, width: vp.width, height: vp.height })
      }

      const bytes = await pdfOut.save() as Uint8Array<ArrayBuffer>
      setResult({ bytes, size: bytes.byteLength })
    } catch (e: any) {
      setError(e?.message || 'שגיאה בדחיסה')
    } finally {
      setProcessing(false)
    }
  }, [file, quality])

  const download = () => {
    if (!result || !file) return
    const blob = new Blob([result.bytes as unknown as ArrayBuffer], { type: 'application/pdf' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = file.name.replace('.pdf', '-compressed.pdf')
    a.click()
  }

  const savedPct = file && result ? Math.round((1 - result.size / file.size) * 100) : 0

  return (
    <ConverterLayout
      title="דחיסת PDF"
      subtitle="הקטן גודל קובץ PDF בלחיצה אחת"
      icon="📦"
      color="#f97316"
    >
      <DropZone file={file} onFile={setFile} inputRef={inputRef} accept=".pdf" label="גרור PDF לכאן" />

      {file && (
        <>
          <div style={{ margin: '16px 0' }}>
            <label className="label">רמת דחיסה</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['low', 'medium', 'high'] as const).map(q => (
                <button key={q}
                  className={`btn ${quality === q ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, fontSize: 13 }}
                  onClick={() => setQuality(q)}>
                  {q === 'low' ? 'גבוהה (קובץ קטן)' : q === 'medium' ? 'בינונית' : 'נמוכה (איכות גבוהה)'}
                </button>
              ))}
            </div>
          </div>

          <button className="btn btn-primary" onClick={compress} disabled={processing}
            style={{ width: '100%', padding: '12px', fontSize: 15 }}>
            {processing ? 'דוחס...' : 'דחוס PDF'}
          </button>
        </>
      )}

      {error && <p style={{ color: 'var(--color-danger)', marginTop: 12 }}>{error}</p>}

      {result && file && (
        <div style={{
          marginTop: 20, padding: 20,
          background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <div style={{ fontWeight: 700, color: '#166534', fontSize: 16 }}>
              {savedPct > 0 ? `✅ נחסכו ${savedPct}%` : '⚠️ ללא שינוי משמעותי'}
            </div>
            <div style={{ fontSize: 13, color: '#16a34a', marginTop: 4 }}>
              {(file.size / 1024).toFixed(0)} KB → {(result.size / 1024).toFixed(0)} KB
            </div>
          </div>
          <button className="btn btn-primary" onClick={download} style={{ background: '#16a34a' }}>
            הורד
          </button>
        </div>
      )}
    </ConverterLayout>
  )
}
