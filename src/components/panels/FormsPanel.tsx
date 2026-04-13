import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAnnotationsStore, usePDFStore, useUIStore } from '../../store'
import type { FormField } from '../../store/types'

export const FormsPanel: React.FC = () => {
  const { t } = useTranslation()
  const { formFields, addFormField, updateFormField, deleteFormField, clearFormData } = useAnnotationsStore()
  const { currentPage, pdfDoc } = usePDFStore()
  const { addToast } = useUIStore()
  const [activeTab, setActiveTab] = useState<'fill' | 'add'>('fill')

  const pageFields = formFields.filter(f => f.pageIndex === currentPage)

  const handleExportJSON = () => {
    const data = formFields.reduce<Record<string, any>>((acc, f) => { acc[f.name || f.id] = f.value; return acc }, {})
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'form-data.json'; a.click()
    URL.revokeObjectURL(url)
    addToast('יוצא JSON', 'success')
  }

  const handleExportCSV = () => {
    const headers = ['שם שדה', 'ערך', 'דף']
    const rows = formFields.map(f => [f.name || f.id, String(f.value), String(f.pageIndex + 1)])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'form-data.csv'; a.click()
    URL.revokeObjectURL(url)
    addToast('יוצא CSV', 'success')
  }

  const addField = (type: FormField['type']) => {
    addFormField({
      type, pageIndex: currentPage,
      rect: { x: 100, y: 100, width: 200, height: 30 },
      name: `שדה_${type}_${Date.now()}`,
      value: type === 'checkbox' ? false : '',
      required: false,
      placeholder: type === 'text' ? 'הקלד כאן...' : ''
    })
    addToast('שדה נוסף', 'success')
  }

  if (!pdfDoc) return (
    <div style={{ padding: 16, color: 'var(--color-text-muted)', fontSize: 13, textAlign: 'center' }}>פתח קובץ PDF</div>
  )

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="panel-title">{t('tools.forms')}</div>

      {/* Tab */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {(['fill','add'] as const).map(tab => (
          <button key={tab} className="btn btn-secondary"
            style={{ flex: 1, justifyContent: 'center', background: activeTab === tab ? 'rgba(37,99,235,0.12)' : undefined, borderColor: activeTab === tab ? 'var(--color-accent)' : undefined, color: activeTab === tab ? 'var(--color-accent)' : undefined, fontSize: 12 }}
            onClick={() => setActiveTab(tab)}>
            {tab === 'fill' ? t('forms.fillForms') : t('forms.addFields')}
          </button>
        ))}
      </div>

      {activeTab === 'fill' && (
        <>
          {pageFields.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center', padding: '12px 0' }}>
              אין שדות בדף זה
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pageFields.map(field => (
                <FieldInput key={field.id} field={field} onUpdate={updateFormField} onDelete={deleteFormField} />
              ))}
            </div>
          )}
          {formFields.length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1, fontSize: 11, justifyContent: 'center' }} onClick={handleExportJSON}>{t('forms.exportJSON')}</button>
              <button className="btn btn-secondary" style={{ flex: 1, fontSize: 11, justifyContent: 'center' }} onClick={handleExportCSV}>{t('forms.exportCSV')}</button>
            </div>
          )}
          {formFields.length > 0 && (
            <button className="btn btn-ghost" style={{ fontSize: 11, color: 'var(--color-danger)', justifyContent: 'center' }} onClick={clearFormData}>
              {t('forms.clearForm')}
            </button>
          )}
        </>
      )}

      {activeTab === 'add' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {(['text','checkbox','radio','dropdown','date'] as FormField['type'][]).map(type => (
            <button key={type} className="btn btn-secondary"
              style={{ fontSize: 11, padding: '6px 8px', justifyContent: 'center', flexDirection: 'column', gap: 2, height: 44 }}
              onClick={() => addField(type)}>
              {type === 'text' ? 'Aa טקסט' : type === 'checkbox' ? '☑ תיבה' : type === 'radio' ? '◉ רדיו' : type === 'dropdown' ? '▼ רשימה' : '📅 תאריך'}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const FieldInput: React.FC<{ field: FormField; onUpdate: (id: string, c: Partial<FormField>) => void; onDelete: (id: string) => void }> = ({ field, onUpdate, onDelete }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label className="label" style={{ margin: 0 }}>{field.name}</label>
        <button className="btn-icon" style={{ width: 20, height: 20, color: 'var(--color-danger)' }} onClick={() => onDelete(field.id)}>×</button>
      </div>
      {field.type === 'checkbox' ? (
        <input type="checkbox" checked={!!field.value}
          onChange={e => onUpdate(field.id, { value: e.target.checked })} />
      ) : field.type === 'dropdown' ? (
        <select className="select" value={String(field.value)}
          onChange={e => onUpdate(field.id, { value: e.target.value })}>
          {(field.options || []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : field.type === 'date' ? (
        <input type="date" className="input" value={String(field.value)}
          onChange={e => onUpdate(field.id, { value: e.target.value })} />
      ) : (
        <input type="text" className="input" value={String(field.value)}
          placeholder={field.placeholder}
          onChange={e => onUpdate(field.id, { value: e.target.value })} />
      )}
    </div>
  )
}
