import React, { useState, useRef, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { ConverterLayout } from './ConverterLayout'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

interface PageResult { pageNum: number; dataUrl: string }

export const PDFToImage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState<'jpeg' | 'png'>('jpeg')
  const [quality, setQuality] = useState(92)
  const [scale, setScale] = useState(2)
  const [results, setResults] = useState<PageResult[]>([])
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const convert = useCallback(async () => {
    if (!file) return
    setProcessing(true); setError(''); setResults([]); setProgress(0)
    try {
      const data = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(data),
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/cmaps/',
        cMapPacked: true,
      }).promise

      const pages: PageResult[] = []
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const vp = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        canvas.width = vp.width; canvas.height = vp.height
        const ctx = canvas.getContext('2d')!
        await page.render({ canvasContext: ctx, viewport: vp, canvas } as any).promise
        const dataUrl = canvas.toDataURL(`image/${format}`, quality / 100)
        pages.push({ pageNum: i, dataUrl })
        setProgress(Math.round((i / pdf.numPages) * 100))
      }
      setResults(pages)
    } catch (e: any) {
      setError(e?.message || 'שגיאה בהמרה')
    } finally {
      setProcessing(false)
    }
  }, [file, format, quality, scale])

  const downloadAll = () => {
    results.forEach(r => {
      const a = document.createElement('a')
      a.href = r.dataUrl
      a.download = `page-${r.pageNum}.${format}`
      a.click()
    })
  }

  return (
    <ConverterLayout
      title="PDF לתמונה"
      subtitle="המר כל דף PDF לתמונת JPEG או PNG באיכות גבוהה"
      icon="🖼️"
      color="#8b5cf6"
    >
      {/* Upload */}
      <DropZone file={file} onFile={setFile} inputRef={inputRef} accept=".pdf" label="גרור PDF לכאן" />

      {file && (
        <>
          {/* Settings */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, margin: '16px 0' }}>
            <div>
              <label className="label">פורמט פלט</label>
              <select className="select" value={format} onChange={e => setFormat(e.target.value as any)} style={{ width: '100%' }}>
                <option value="jpeg">JPEG (קטן יותר)</option>
                <option value="png">PNG (שקיפות)</option>
              </select>
            </div>
            <div>
              <label className="label">רזולוציה: {scale}x</label>
              <select className="select" value={scale} onChange={e => setScale(+e.target.value)} style={{ width: '100%' }}>
                <option value={1}>1x (72 DPI)</option>
                <option value={2}>2x (144 DPI)</option>
                <option value={3}>3x (216 DPI)</option>
                <option value={4}>4x (288 DPI - איכות גבוהה)</option>
              </select>
            </div>
            {format === 'jpeg' && (
              <div style={{ gridColumn: '1/-1' }}>
                <label className="label">איכות JPEG: {quality}%</label>
                <input type="range" min={60} max={100} value={quality}
                  onChange={e => setQuality(+e.target.value)} style={{ width: '100%' }} />
              </div>
            )}
          </div>

          <button className="btn btn-primary" onClick={convert} disabled={processing}
            style={{ width: '100%', padding: '12px', fontSize: 15 }}>
            {processing ? `ממיר... ${progress}%` : `המר ${file.name}`}
          </button>
        </>
      )}

      {error && <p style={{ color: 'var(--color-danger)', marginTop: 12 }}>{error}</p>}

      {results.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 600 }}>{results.length} תמונות</span>
            <button className="btn btn-secondary" onClick={downloadAll}>הורד הכל</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {results.map(r => (
              <div key={r.pageNum} style={{
                border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden',
                background: 'var(--color-surface)'
              }}>
                <img src={r.dataUrl} alt={`עמוד ${r.pageNum}`}
                  style={{ width: '100%', display: 'block', aspectRatio: '0.707', objectFit: 'contain' }} />
                <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>עמוד {r.pageNum}</span>
                  <a href={r.dataUrl} download={`page-${r.pageNum}.${format}`}
                    className="btn btn-secondary"
                    style={{ padding: '4px 10px', fontSize: 12 }}>הורד</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </ConverterLayout>
  )
}

// Shared DropZone
export const DropZone: React.FC<{
  file: File | null
  onFile: (f: File) => void
  inputRef: React.RefObject<HTMLInputElement>
  accept: string
  label: string
  multiple?: boolean
  onFiles?: (files: File[]) => void
}> = ({ file, onFile, onFiles, inputRef, accept, label, multiple }) => {
  const [drag, setDrag] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false)
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf')
    if (!files.length) return
    if (multiple && onFiles) onFiles(files)
    else onFile(files[0])
  }

  return (
    <label
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        border: `2px dashed ${drag ? 'var(--color-accent)' : 'var(--color-border)'}`,
        borderRadius: 16, padding: '40px 24px', cursor: 'pointer', textAlign: 'center',
        background: drag ? '#eff6ff' : 'var(--color-surface)',
        transition: 'all 180ms cubic-bezier(0.23, 1, 0.32, 1)',
      }}
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
    >
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} style={{ display: 'none' }}
        onChange={e => {
          const files = Array.from(e.target.files || [])
          if (!files.length) return
          if (multiple && onFiles) onFiles(files)
          else onFile(files[0])
        }} />
      <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
      {file ? (
        <>
          <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{file.name}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
            {(file.size / 1024 / 1024).toFixed(2)} MB · לחץ להחלפה
          </div>
        </>
      ) : (
        <>
          <div style={{ fontWeight: 600 }}>{label}</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>או לחץ לבחירת קובץ</div>
        </>
      )}
    </label>
  )
}
