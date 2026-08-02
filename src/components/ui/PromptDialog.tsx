import React, { useEffect, useRef, useState } from 'react'
import { useUIStore } from '../../store'

const EASE = 'cubic-bezier(0.23,1,0.32,1)'

/**
 * Text-input dialog (file names etc.) — the input counterpart of
 * ConfirmDialog, driven by useUIStore().promptText().
 */
export const PromptDialog: React.FC = () => {
  const { promptDialog, resolvePrompt } = useUIStore()
  const { open, title, value, suffix } = promptDialog
  const [text, setText] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setText(value)
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 60)
  }, [open, value])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resolvePrompt(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, resolvePrompt])

  if (!open) return null

  const submit = () => {
    const v = text.trim()
    if (!v) return
    resolvePrompt(v)
  }

  return (
    <div
      className="modal-overlay no-print"
      onClick={() => resolvePrompt(null)}
      style={{ zIndex: 2000 }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)',
          borderRadius: 20,
          padding: '24px 24px 20px',
          width: 400,
          maxWidth: '92vw',
          boxShadow: '0 24px 80px rgba(0,0,0,0.30), 0 4px 16px rgba(0,0,0,0.10)',
          animation: `modalIn 0.25s ${EASE} both`,
        }}
      >
        <h3 style={{
          fontSize: 17, fontWeight: 700, color: 'var(--color-text)',
          margin: '0 0 14px', textAlign: 'center',
        }}>
          {title}
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, direction: 'ltr' }}>
          <input
            ref={inputRef}
            className="input"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit() }}
            dir="auto"
            style={{ flex: 1, fontSize: 15, textAlign: 'center' }}
          />
          {suffix && (
            <span style={{ fontSize: 13.5, color: 'var(--color-text-muted)', fontWeight: 600, flexShrink: 0 }}>
              {suffix}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button
            onClick={() => resolvePrompt(null)}
            style={{
              flex: 1, padding: '11px 16px', borderRadius: 12, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', border: 'none',
              background: 'var(--color-surface-2)', color: 'var(--color-text)',
            }}
          >
            ביטול
          </button>
          <button
            onClick={submit}
            disabled={!text.trim()}
            style={{
              flex: 1, padding: '11px 16px', borderRadius: 12, fontSize: 14, fontWeight: 600,
              cursor: text.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit', border: 'none',
              background: 'var(--color-accent)', color: 'var(--color-on-accent)',
              opacity: text.trim() ? 1 : 0.5,
              transition: `transform 150ms ${EASE}`,
            }}
            onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)' }}
            onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
          >
            הורד
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Ask for a file name before a download. Returns the full name with the
 * given extension, or null if the user cancelled.
 */
export async function askFileName(defaultFullName: string, ext: string): Promise<string | null> {
  const base = defaultFullName.replace(new RegExp(`\\${ext}$`, 'i'), '')
  const name = await useUIStore.getState().promptText({
    title: 'שם הקובץ להורדה',
    value: base,
    suffix: ext,
  })
  if (name === null) return null
  return name.replace(new RegExp(`\\${ext}$`, 'i'), '') + ext
}
