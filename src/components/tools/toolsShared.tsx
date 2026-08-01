import React, { useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

/**
 * Shared building blocks for the PDF tool panels — kept in one place so each
 * panel file stays about its own logic.
 */

export const EASE = 'cubic-bezier(0.23,1,0.32,1)'

export async function renderPageCanvas(pdfDoc: any, pageNum: number, scale: number): Promise<HTMLCanvasElement> {
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

export async function loadEditedForRender(getEdited: (o?: { withDecorations?: boolean }) => Promise<Uint8Array>): Promise<any> {
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


export function parseRanges(input: string, max: number): number[] {
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


export const Spinner = () => (
  <svg className="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" />
  </svg>
)

// ─────────────────────────────────────────────────────────────
// Panel router
// ─────────────────────────────────────────────────────────────

export const EmptyHint: React.FC = () => (
  <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-muted)' }}>
    <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>פתח קובץ PDF כדי להשתמש בכלי זה</div>
  </div>
)


export const InfoBar: React.FC<{ text: string }> = ({ text }) => (
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


export const FilePicker: React.FC<{ accept: string; multiple?: boolean; label: string; onPick: (files: File[]) => void }> =
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


export const FileRow: React.FC<{ name: string; size: number; onRemove: () => void }> = ({ name, size, onRemove }) => (
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


export const SegmentedControl: React.FC<{ label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }> =
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


export const PrimaryButton: React.FC<{ onClick: () => void; disabled?: boolean; children: React.ReactNode }> = ({ onClick, disabled, children }) => (
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


export const GhostButton: React.FC<{ onClick: () => void; disabled?: boolean; children: React.ReactNode }> = ({ onClick, disabled, children }) => (
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
