import React from 'react'
import { useAnnotationsStore, useUIStore } from '../../store'
import type { FormField } from '../../store/types'
import { radioSiblings } from '../../utils/formFields'

interface Props {
  pageIndex: number
  zoom: number
}

/**
 * Interactive overlay for the PDF's own AcroForm fields.
 *
 * The widgets are detected on load and mirrored here as real HTML controls,
 * so a Hebrew form can be filled with an ordinary keyboard. The values are
 * baked into the page content on export — the original widgets are dropped,
 * because a viewer draws a widget's (empty) appearance over page content and
 * would hide what was typed.
 */
export const FormFieldsLayer: React.FC<Props> = ({ pageIndex, zoom }) => {
  const { formFields, updateFormField } = useAnnotationsStore()
  const { activeTool } = useUIStore()

  const pageFields = formFields.filter(f => f.pageIndex === pageIndex)
  if (!pageFields.length) return null

  const interactive = activeTool === 'select'

  const setValue = (field: FormField, value: string | boolean) => {
    if (field.type === 'radio' && value === true) {
      // One choice per group — turning one on turns the siblings off
      radioSiblings(useAnnotationsStore.getState().formFields, field)
        .forEach(sib => { if (sib.id !== field.id) updateFormField(sib.id, { value: false }) })
    }
    updateFormField(field.id, { value })
  }

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0,
      width: '100%', height: '100%',
      pointerEvents: interactive ? 'auto' : 'none',
      zIndex: 8,
    }}>
      {pageFields.map(field => {
        const box: React.CSSProperties = {
          position: 'absolute',
          left: field.rect.x * zoom,
          top: field.rect.y * zoom,
          width: field.rect.width * zoom,
          height: field.rect.height * zoom,
          boxSizing: 'border-box',
        }
        const fontSize = Math.max(9, Math.min(16, field.rect.height * 0.62)) * zoom
        const common: React.CSSProperties = {
          ...box,
          border: '1px solid var(--color-accent)',
          background: 'rgba(56,132,255,0.07)',
          borderRadius: 2 * zoom,
          fontFamily: 'inherit',
          fontSize,
          padding: `0 ${3 * zoom}px`,
          color: '#111',
        }

        if (field.type === 'checkbox' || field.type === 'radio') {
          const on = field.value === true
          return (
            <button
              key={field.id}
              type="button"
              role={field.type === 'radio' ? 'radio' : 'checkbox'}
              aria-checked={on}
              aria-label={field.name}
              title={field.name}
              onClick={() => setValue(field, field.type === 'radio' ? true : !on)}
              style={{
                ...common,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0,
                borderRadius: field.type === 'radio' ? '50%' : 2 * zoom,
                background: on ? 'var(--color-accent)' : 'rgba(56,132,255,0.07)',
                color: on ? 'var(--color-on-accent)' : 'transparent',
                fontWeight: 800,
                lineHeight: 1,
              }}
            >
              {field.type === 'radio' ? '●' : '✓'}
            </button>
          )
        }

        if (field.type === 'dropdown') {
          return (
            <select
              key={field.id}
              aria-label={field.name}
              title={field.name}
              value={String(field.value ?? '')}
              onChange={e => setValue(field, e.target.value)}
              style={{ ...common, cursor: 'pointer' }}
            >
              <option value=""></option>
              {(field.options || []).map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
            </select>
          )
        }

        return (
          <input
            key={field.id}
            type="text"
            aria-label={field.name}
            title={field.name}
            placeholder={field.placeholder}
            value={String(field.value ?? '')}
            onChange={e => setValue(field, e.target.value)}
            // Keep a click inside the field from reaching the page's
            // deselect handler, which would blur it again on mobile
            onPointerDown={e => e.stopPropagation()}
            style={common}
          />
        )
      })}
    </div>
  )
}
