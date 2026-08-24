import React, { useState } from 'react'
import { usePDF } from '../../hooks/usePDF'
import { useUIStore, useAnnotationsStore } from '../../store'
import { PAGE_PRESETS, createBlankPdf, mmToPoints, pointsToMm } from '../../utils/blankDoc'

const EASE = 'cubic-bezier(0.23,1,0.32,1)'

const BACKGROUNDS: Array<{ id: string; label: string; hex: string }> = [
  { id: 'white', label: 'לבן', hex: '#ffffff' },
  { id: 'cream', label: 'שמנת', hex: '#fdf6e3' },
  { id: 'grey',  label: 'אפור בהיר', hex: '#f1f5f9' },
  { id: 'navy',  label: 'כחול כהה', hex: '#0f172a' },
]

/**
 * Entry point of the authoring area: choose a page and get real blank pages.
 * From there the whole editor — every tool, every export path — applies as-is,
 * because a created document is just a PDF like any other.
 */
export const NewDocumentPanel: React.FC = () => {
  const { loadPDF } = usePDF()
  const { addToast } = useUIStore()
  const [presetId, setPresetId] = useState('a4')
  const [landscape, setLandscape] = useState(false)
  const [count, setCount] = useState('1')
  const [background, setBackground] = useState('#ffffff')
  const [customW, setCustomW] = useState('')
  const [customH, setCustomH] = useState('')
  const [busy, setBusy] = useState(false)

  const preset = PAGE_PRESETS.find(p => p.id === presetId)!
  const custom = presetId === 'custom'
  const baseW = custom ? mmToPoints(parseFloat(customW) || 0) : preset.width
  const baseH = custom ? mmToPoints(parseFloat(customH) || 0) : preset.height
  const width = landscape ? baseH : baseW
  const height = landscape ? baseW : baseH
  const valid = width > 20 && height > 20

  const create = async () => {
    if (!valid) { addToast('הזן מידות תקינות', 'warning'); return }
    setBusy(true)
    try {
      const bytes = await createBlankPdf({
        width, height,
        count: parseInt(count) || 1,
        background,
      })
      // A new document starts with an empty object layer, or the previous
      // document's annotations would land on top of it
      useAnnotationsStore.setState({ annotations: [], formFields: [], past: [], future: [], selectedId: null })
      await loadPDF(bytes.buffer as ArrayBuffer, { name: 'מסמך חדש.pdf', preserveAnnotations: true })
    } catch (e) {
      console.error(e)
      addToast('שגיאה ביצירת המסמך', 'error')
    } finally { setBusy(false) }
  }

  return (
    <div style={{
      maxWidth: 460, width: '100%', padding: '24px 20px',
      maxHeight: '100%', overflowY: 'auto',
    }}>
      <div style={{
        background: 'var(--color-surface)', borderRadius: 22,
        border: '1px solid var(--color-border)',
        padding: '22px 20px 20px',
        boxShadow: '0 12px 44px rgba(0,0,0,0.10)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 34, lineHeight: 1, marginBottom: 8 }}>✨</div>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: 'var(--color-text)' }}>
            מסמך חדש
          </h2>
          <p style={{ margin: '5px 0 0', fontSize: 12.5, color: 'var(--color-text-muted)' }}>
            בחר גודל דף והתחל לכתוב, להדביק ולסדר
          </p>
        </div>

        {/* Page size */}
        <label className="label">גודל דף</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {[...PAGE_PRESETS, { id: 'custom', label: 'מותאם', width: 0, height: 0 }].map(p => {
            const active = presetId === p.id
            return (
              <button
                key={p.id}
                onClick={() => setPresetId(p.id)}
                aria-pressed={active}
                style={{
                  padding: '7px 13px', borderRadius: 20, cursor: 'pointer',
                  border: `1.5px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  background: active ? 'var(--color-accent)' : 'var(--color-surface-2)',
                  color: active ? 'var(--color-on-accent)' : 'var(--color-text)',
                  fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', minHeight: 0,
                  transition: `background 140ms ${EASE}`,
                }}
              >
                {p.label}
              </button>
            )
          })}
        </div>

        {custom && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <label className="label" htmlFor="new-doc-w">רוחב (מ״מ)</label>
              <input id="new-doc-w" className="input" value={customW} inputMode="decimal" dir="ltr"
                onChange={e => setCustomW(e.target.value.replace(/[^\d.]/g, ''))}
                placeholder="210" style={{ width: '100%', textAlign: 'center' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="label" htmlFor="new-doc-h">גובה (מ״מ)</label>
              <input id="new-doc-h" className="input" value={customH} inputMode="decimal" dir="ltr"
                onChange={e => setCustomH(e.target.value.replace(/[^\d.]/g, ''))}
                placeholder="297" style={{ width: '100%', textAlign: 'center' }} />
            </div>
          </div>
        )}

        {/* Orientation */}
        <label className="label">כיוון</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {[{ id: false, label: '▯ לאורך' }, { id: true, label: '▭ לרוחב' }].map(o => (
            <button
              key={String(o.id)}
              onClick={() => setLandscape(o.id)}
              aria-pressed={landscape === o.id}
              style={{
                flex: 1, padding: '9px 10px', borderRadius: 12, cursor: 'pointer',
                border: `1.5px solid ${landscape === o.id ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: landscape === o.id ? 'rgba(37,99,235,0.10)' : 'var(--color-surface-2)',
                color: 'var(--color-text)', fontSize: 13, fontWeight: 600,
                fontFamily: 'inherit', minHeight: 0,
              }}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Background */}
        <label className="label">רקע</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {BACKGROUNDS.map(b => (
            <button
              key={b.id}
              onClick={() => setBackground(b.hex)}
              aria-label={b.label}
              title={b.label}
              aria-pressed={background === b.hex}
              style={{
                width: 38, height: 38, borderRadius: 10, cursor: 'pointer', padding: 0, minHeight: 0,
                background: b.hex,
                border: `2.5px solid ${background === b.hex ? 'var(--color-accent)' : 'var(--color-border)'}`,
              }}
            />
          ))}
          <input
            type="color"
            aria-label="צבע רקע מותאם"
            value={background}
            onChange={e => setBackground(e.target.value)}
            style={{
              width: 38, height: 38, borderRadius: 10, padding: 0, cursor: 'pointer',
              border: '2.5px solid var(--color-border)', background: 'transparent', minHeight: 0,
            }}
          />
        </div>

        {/* Page count */}
        <label className="label" htmlFor="new-doc-count">מספר עמודים</label>
        <input
          id="new-doc-count" className="input" value={count} inputMode="numeric" dir="ltr"
          onChange={e => setCount(e.target.value.replace(/\D/g, '').slice(0, 3))}
          style={{ width: '100%', textAlign: 'center', marginBottom: 16 }}
        />

        <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', textAlign: 'center', marginBottom: 12 }}>
          {valid
            ? `${Math.round(pointsToMm(width))} × ${Math.round(pointsToMm(height))} מ״מ`
            : 'הזן מידות תקינות'}
        </div>

        <button
          onClick={create}
          disabled={busy || !valid}
          style={{
            width: '100%', padding: '13px 16px', borderRadius: 14, border: 'none',
            background: 'var(--color-accent)', color: 'var(--color-on-accent)',
            fontSize: 14.5, fontWeight: 700, fontFamily: 'inherit',
            cursor: busy || !valid ? 'not-allowed' : 'pointer',
            opacity: busy || !valid ? 0.6 : 1,
            transition: `transform 140ms ${EASE}`,
          }}
        >
          {busy ? 'יוצר…' : 'צור מסמך'}
        </button>
      </div>
    </div>
  )
}
