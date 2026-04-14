import React, { useState, useRef, useCallback } from 'react'
import { PDFDocument } from 'pdf-lib'
import { ConverterLayout } from './ConverterLayout'
import { DropZone } from './PDFToImage'

export const SplitPDF: React.FC = () => {
  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<'all' | 'range'>('all')
  const [rangeInput, setRangeInput] = useState('1-3, 5, 7-9')
  const [pageCount, setPageCount] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const loadPageCount = async (f: File) => {
    try {
      const bytes = await f.arrayBuffer()
      const doc = await PDFDocument.load(bytes)
      setPageCount(doc.getPageCount())
    } catch { setPageCount(0) }
  }

  const handleFile = (f: File) => {
    setFile(f); setPageCount(0); setError('')
    loadPageCount(f)
  }

  const parseRanges = (input: string, max: number): number[][] => {
    const parts = input.split(',').map(s => s.trim()).filter(Boolean)
    const groups: number[][] = []
    for (const part of parts) {
      if (part.includes('-')) {
        const [a, b] = part.split('-').map(Number)
        const pages: number[] = []
        for (let i = Math.max(1, a); i <= Math.min(max, b); i++) pages.push(i - 1)
        if (pages.length) groups.push(pages)
      } else {
        const n = parseInt(part)
        if (n >= 1 && n <= max) groups.push([n - 1])
      }
    }
    return groups
  }

  const split = useCallback(async () => {
    if (!file) return
    setProcessing(true); setError('')
    try {
      const srcBytes = await file.arrayBuffer()
      const srcDoc = await PDFDocument.load(srcBytes)
      const total = srcDoc.getPageCount()

      const groups: number[][] = mode === 'all'
        ? Array.from({ length: total }, (_, i) => [i])
        : parseRanges(rangeInput, total)

      for (let gi = 0; gi < groups.length; gi++) {
        const pages = groups[gi]
        const out = await PDFDocument.create()
        const copied = await out.copyPages(srcDoc, pages)
        copied.forEach(p => out.addPage(p))
        const bytes = await out.save()
        const blob = new Blob([bytes as unknown as ArrayBuffer], { type: 'application/pdf' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        const label = mode === 'all' ? `page-${pages[0] + 1}` : `part-${gi + 1}`
        a.download = file.name.replace('.pdf', `-${label}.pdf`)
        a.click()
        await new Promise(r => setTimeout(r, 80))
      }
    } catch (e: any) {
      setError(e?.message || 'שגיאה בפיצול')
    } finally {
      setProcessing(false)
    }
  }, [file, mode, rangeInput])

  return (
    <ConverterLayout
      title="פיצול PDF"
      subtitle="פצל קובץ PDF לדפים נפרדים או לטווחי עמודים"
      icon="✂️"
      color="#22c55e"
    >
      <DropZone file={file} onFile={handleFile} inputRef={inputRef} accept=".pdf" label="גרור PDF לכאן" />

      {file && (
        <>
          {pageCount > 0 && (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '12px 0 0' }}>
              {pageCount} עמודים במסמך
            </p>
          )}

          <div style={{ margin: '16px 0' }}>
            <label className="label">אופן פיצול</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={`btn ${mode === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1 }} onClick={() => setMode('all')}>
                כל עמוד לקובץ נפרד
              </button>
              <button className={`btn ${mode === 'range' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1 }} onClick={() => setMode('range')}>
                טווחים מותאמים
              </button>
            </div>
          </div>

          {mode === 'range' && (
            <div style={{ marginBottom: 16 }}>
              <label className="label">טווחי עמודים</label>
              <input
                className="input"
                value={rangeInput}
                onChange={e => setRangeInput(e.target.value)}
                placeholder="לדוגמה: 1-3, 5, 7-9"
                style={{ width: '100%' }}
              />
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
                הפרד טווחים בפסיק. כל טווח ייצור קובץ PDF נפרד.
              </p>
            </div>
          )}

          <button className="btn btn-primary" onClick={split} disabled={processing}
            style={{ width: '100%', padding: '12px', fontSize: 15 }}>
            {processing ? 'מפצל...' : 'פצל PDF'}
          </button>
        </>
      )}

      {error && <p style={{ color: 'var(--color-danger)', marginTop: 12 }}>{error}</p>}
    </ConverterLayout>
  )
}
