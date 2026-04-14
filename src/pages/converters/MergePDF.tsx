import React, { useState, useRef, useCallback } from 'react'
import { PDFDocument } from 'pdf-lib'
import { ConverterLayout } from './ConverterLayout'

export const MergePDF: React.FC = () => {
  const [files, setFiles] = useState<File[]>([])
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = (newFiles: File[]) => {
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name))
      return [...prev, ...newFiles.filter(f => !existing.has(f.name))]
    })
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const moveFile = (from: number, to: number) => {
    setFiles(prev => {
      const arr = [...prev]
      const [item] = arr.splice(from, 1)
      arr.splice(to, 0, item)
      return arr
    })
  }

  const merge = useCallback(async () => {
    if (files.length < 2) return
    setProcessing(true); setError('')
    try {
      const merged = await PDFDocument.create()
      for (const file of files) {
        const bytes = await file.arrayBuffer()
        const doc = await PDFDocument.load(bytes)
        const pages = await merged.copyPages(doc, doc.getPageIndices())
        pages.forEach(p => merged.addPage(p))
      }
      const bytes = await merged.save()
      const blob = new Blob([bytes as unknown as ArrayBuffer], { type: 'application/pdf' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'merged.pdf'
      a.click()
    } catch (e: any) {
      setError(e?.message || 'שגיאה במיזוג')
    } finally {
      setProcessing(false)
    }
  }, [files])

  return (
    <ConverterLayout
      title="מיזוג PDF"
      subtitle="מזג מספר קבצי PDF לקובץ אחד — גרור לסידור מחדש"
      icon="🔗"
      color="#ef4444"
    >
      {/* Drop zone */}
      <label
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          border: '2px dashed var(--color-border)', borderRadius: 16,
          padding: '32px 24px', cursor: 'pointer', textAlign: 'center',
          background: 'var(--color-surface)',
          transition: 'border-color 180ms cubic-bezier(0.23, 1, 0.32, 1)',
        }}
        onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--color-accent)' }}
        onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
        onDrop={e => {
          e.preventDefault()
          e.currentTarget.style.borderColor = 'var(--color-border)'
          const dropped = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf')
          addFiles(dropped)
        }}
      >
        <input ref={inputRef} type="file" accept=".pdf" multiple style={{ display: 'none' }}
          onChange={e => addFiles(Array.from(e.target.files || []))} />
        <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
        <div style={{ fontWeight: 600 }}>גרור קבצי PDF לכאן</div>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>או לחץ לבחירת מספר קבצים</div>
      </label>

      {/* File list */}
      {files.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label className="label" style={{ margin: 0 }}>{files.length} קבצים לאיחוד</label>
            <button className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }}
              onClick={() => inputRef.current?.click()}>+ הוסף</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {files.map((f, i) => (
              <div key={f.name}
                draggable
                onDragStart={e => e.dataTransfer.setData('idx', String(i))}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault()
                  const from = +e.dataTransfer.getData('idx')
                  if (from !== i) moveFile(from, i)
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', borderRadius: 10,
                  background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
                  cursor: 'grab',
                }}
              >
                <span style={{ color: 'var(--color-text-muted)', fontSize: 18 }}>⠿</span>
                <span style={{ fontSize: 13, fontWeight: 500, flex: 1, textAlign: 'start', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ color: 'var(--color-accent)', marginLeft: 8, fontWeight: 700 }}>{i + 1}.</span>
                  {f.name}
                </span>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', flexShrink: 0 }}>
                  {(f.size / 1024).toFixed(0)} KB
                </span>
                <button
                  onClick={() => removeFile(i)}
                  style={{
                    width: 22, height: 22, borderRadius: '50%', border: 'none',
                    background: '#fee2e2', color: '#ef4444', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, flexShrink: 0
                  }}
                >×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p style={{ color: 'var(--color-danger)', marginTop: 12 }}>{error}</p>}

      {files.length >= 2 && (
        <button className="btn btn-primary" onClick={merge} disabled={processing}
          style={{ width: '100%', padding: '12px', fontSize: 15, marginTop: 16 }}>
          {processing ? 'ממזג...' : `מזג ${files.length} קבצים`}
        </button>
      )}

      {files.length === 1 && (
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13, marginTop: 12 }}>
          הוסף לפחות עוד קובץ PDF אחד למיזוג
        </p>
      )}
    </ConverterLayout>
  )
}
