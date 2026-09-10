import React, { useMemo, useState } from 'react'
import { usePDFStore, useUIStore, type PageNumberSettings } from '../../../store'
import { STAMP_DEFAULTS, stampConfig, stampText, type DateFormat } from '../../../utils/pageStamp'
import { EmptyHint, InfoBar, PrimaryButton, GhostButton } from '../toolsShared'

/** Ready-made headers and footers, so the common cases need no typing. */
const PRESETS: Array<{ label: string; template: string }> = [
  { label: '1', template: '{n}' },
  { label: '1 מתוך 12', template: '{n} מתוך {total}' },
  { label: 'עמוד 1', template: 'עמוד {n}' },
  { label: '- 1 -', template: '- {n} -' },
  { label: 'תאריך', template: '{date}' },
  { label: 'תאריך ומספר', template: '{date} · {n}' },
]

const FONTS = ['Heebo', 'Arial', 'Times New Roman', 'Courier New']
const SWATCHES = ['#595959', '#000000', '#2563eb', '#dc2626', '#059669', '#a1a1aa']

const VERTICALS = [
  { value: 'top' as const, label: 'עליון' },
  { value: 'bottom' as const, label: 'תחתון' },
]
const HORIZONTALS = [
  { value: 'right' as const, label: 'ימין' },
  { value: 'center' as const, label: 'מרכז' },
  { value: 'left' as const, label: 'שמאל' },
]

/**
 * The running header or footer: page numbers, a title, a date, or a mix.
 *
 * It is written as a setting rather than as ink, which is what lets it survive
 * editing — every page works out its own number from where it sits, so adding
 * or deleting pages renumbers the document with nothing to press. The ink is
 * made only on the way out to a file.
 */
export const PageNumbersPanel: React.FC = () => {
  const { pdfDoc, pageNumbers, setPageNumbers, pageCount, pageOrder } = usePDFStore()
  const { addToast } = useUIStore()

  const initial = pageNumbers ? stampConfig(pageNumbers) : null
  const [template, setTemplate] = useState(initial?.template ?? STAMP_DEFAULTS.template)
  const [vertical, setVertical] = useState(initial?.vertical ?? STAMP_DEFAULTS.vertical)
  const [horizontal, setHorizontal] = useState(initial?.horizontal ?? 'center')
  const [fontFamily, setFontFamily] = useState(initial?.fontFamily ?? STAMP_DEFAULTS.fontFamily)
  const [fontSize, setFontSize] = useState(initial?.fontSize ?? STAMP_DEFAULTS.fontSize)
  const [color, setColor] = useState(initial?.color ?? STAMP_DEFAULTS.color)
  const [bold, setBold] = useState(initial?.bold ?? STAMP_DEFAULTS.bold)
  const [startAt, setStartAt] = useState(String(pageNumbers?.startAt ?? 1))
  const [fromPage, setFromPage] = useState(String(initial?.fromPage ?? 1))
  const [toPage, setToPage] = useState(initial?.toPage != null ? String(initial.toPage) : '')
  const [dateFormat, setDateFormat] = useState<DateFormat>(initial?.dateFormat ?? STAMP_DEFAULTS.dateFormat)

  const total = pageOrder.length || pageCount || 1

  const settings: PageNumberSettings = useMemo(() => ({
    position: horizontal,
    startAt: parseInt(startAt) || 1,
    dx: pageNumbers?.dx ?? 0,
    dy: pageNumbers?.dy ?? 0,
    template,
    vertical,
    fontFamily,
    fontSize,
    color,
    bold,
    fromPage: Math.max(1, parseInt(fromPage) || 1),
    toPage: toPage.trim() ? Math.max(1, parseInt(toPage)) : null,
    dateFormat,
  }), [horizontal, startAt, template, vertical, fontFamily, fontSize, color, bold,
    fromPage, toPage, dateFormat, pageNumbers?.dx, pageNumbers?.dy])

  if (!pdfDoc) return <EmptyHint />

  const apply = () => {
    setPageNumbers(settings)
    addToast(pageNumbers ? 'המספור עודכן' : 'נוסף — אפשר לגרור אותו על הדף למיקום מדויק', 'success')
  }

  const refresh = () => {
    // The layer already recomputes on every render, so this is a nudge for the
    // user's benefit as much as the document's — it says out loud that the
    // numbering has caught up with pages added or removed since.
    setPageNumbers({ ...settings })
    addToast(`המספור חושב מחדש לפי ${total} העמודים הנוכחיים`, 'success')
  }

  const remove = () => {
    setPageNumbers(null)
    addToast('המספור הוסר', 'success')
  }

  const previewFirst = stampText(settings, 0, total)
  const previewLast = stampText(settings, Math.max(0, total - 1), total)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <InfoBar text="נשמר כשכבה חיה: מוסיפים או מוחקים דפים והמספור מתעדכן מעצמו. נטבע בקובץ רק בשמירה." />

      {/* Live preview — the page, in miniature, with the stamp where it lands */}
      <div>
        <label className="label">תצוגה מקדימה</label>
        <div
          data-stamp-preview
          style={{
            position: 'relative',
            width: '100%', aspectRatio: '1 / 1.414',
            maxHeight: 220,
            margin: '0 auto',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          {/* Stand-in for the page's own content, so the margin reads correctly */}
          <div style={{
            position: 'absolute', insetInlineStart: '14%', insetInlineEnd: '14%',
            top: '22%', display: 'flex', flexDirection: 'column', gap: 5,
          }}>
            {[100, 92, 96, 78].map((w, i) => (
              <div key={i} style={{ height: 4, width: `${w}%`, borderRadius: 2, background: 'var(--color-surface-2)' }} />
            ))}
          </div>
          <div
            style={{
              position: 'absolute',
              [vertical === 'top' ? 'top' : 'bottom']: '5%',
              ...(horizontal === 'center'
                ? { left: '50%', transform: 'translateX(-50%)' }
                : horizontal === 'right' ? { right: '7%' } : { left: '7%' }),
              fontSize: Math.max(7, fontSize * 0.78),
              fontWeight: bold ? 700 : 400,
              fontFamily: `'${fontFamily}', sans-serif`,
              color,
              whiteSpace: 'nowrap',
            }}
          >
            {previewFirst || '—'}
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6, textAlign: 'center' }}>
          עמוד ראשון: {previewFirst || '—'} · אחרון: {previewLast || '—'}
        </div>
      </div>

      {/* What it says */}
      <div>
        <label className="label">מה יופיע</label>
        <input
          className="input"
          value={template}
          onChange={e => setTemplate(e.target.value)}
          placeholder="{n}"
          style={{ width: '100%' }}
        />
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6, lineHeight: 1.6 }}>
          <code>{'{n}'}</code> מספר העמוד · <code>{'{total}'}</code> סך העמודים · <code>{'{date}'}</code> התאריך.
          כל שאר הטקסט נכתב כמו שהוא.
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {PRESETS.map(p => (
            <button
              key={p.template}
              onClick={() => setTemplate(p.template)}
              style={{
                padding: '5px 11px', borderRadius: 999, cursor: 'pointer',
                border: `1px solid ${template === p.template ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: template === p.template ? 'var(--color-mint)' : 'transparent',
                color: 'var(--color-text)', fontSize: 11.5, fontFamily: 'inherit',
                minHeight: 0,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Where it goes — a picture of the page, not two dropdowns */}
      <div>
        <label className="label">מיקום</label>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6,
          border: '1px solid var(--color-border)', borderRadius: 12, padding: 6,
        }}>
          {VERTICALS.map(v => HORIZONTALS.map(h => {
            const on = vertical === v.value && horizontal === h.value
            return (
              <button
                key={`${v.value}-${h.value}`}
                onClick={() => { setVertical(v.value); setHorizontal(h.value) }}
                aria-pressed={on}
                aria-label={`${v.label} ${h.label}`}
                style={{
                  height: 40, borderRadius: 9, cursor: 'pointer',
                  border: `1.5px solid ${on ? 'var(--color-accent)' : 'transparent'}`,
                  background: on ? 'var(--color-mint)' : 'var(--color-surface-2)',
                  color: on ? 'var(--color-ink-black)' : 'var(--color-text-muted)',
                  fontSize: 11, fontWeight: on ? 700 : 500, fontFamily: 'inherit',
                  minHeight: 0, padding: 0,
                }}
              >
                {v.label} {h.label}
              </button>
            )
          }))}
        </div>
      </div>

      {/* How it looks */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="label">גופן</label>
          <select
            className="input" value={fontFamily}
            onChange={e => setFontFamily(e.target.value)}
            style={{ width: '100%' }}
          >
            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="label">גודל · {fontSize}</label>
          <input
            type="range" min={6} max={36} step={1} value={fontSize}
            onChange={e => setFontSize(Number(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <div>
        <label className="label">צבע</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {SWATCHES.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={`צבע ${c}`}
              aria-pressed={color.toLowerCase() === c}
              style={{
                width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', padding: 0,
                background: c, minHeight: 0,
                border: color.toLowerCase() === c
                  ? '2.5px solid var(--color-accent)' : '1px solid var(--color-border)',
              }}
            />
          ))}
          <input
            type="color" value={color} onChange={e => setColor(e.target.value)}
            aria-label="צבע מותאם"
            style={{ width: 34, height: 28, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
          />
          <button
            onClick={() => setBold(b => !b)}
            aria-pressed={bold}
            style={{
              marginInlineStart: 'auto', padding: '5px 14px', borderRadius: 9, cursor: 'pointer',
              border: `1px solid ${bold ? 'var(--color-accent)' : 'var(--color-border)'}`,
              background: bold ? 'var(--color-mint)' : 'transparent',
              color: 'var(--color-text)', fontWeight: 800, fontSize: 13, fontFamily: 'inherit',
              minHeight: 0,
            }}
          >
            מודגש
          </button>
        </div>
      </div>

      {/* Which pages, and from what number */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div>
          <label className="label">התחל ממספר</label>
          <input
            className="input" value={startAt} inputMode="numeric" dir="ltr"
            onChange={e => setStartAt(e.target.value.replace(/\D/g, ''))}
            style={{ width: '100%', textAlign: 'center' }}
          />
        </div>
        <div>
          <label className="label">מעמוד</label>
          <input
            className="input" value={fromPage} inputMode="numeric" dir="ltr"
            onChange={e => setFromPage(e.target.value.replace(/\D/g, ''))}
            style={{ width: '100%', textAlign: 'center' }}
          />
        </div>
        <div>
          <label className="label">עד עמוד</label>
          <input
            className="input" value={toPage} inputMode="numeric" dir="ltr"
            placeholder={String(total)}
            onChange={e => setToPage(e.target.value.replace(/\D/g, ''))}
            style={{ width: '100%', textAlign: 'center' }}
          />
        </div>
      </div>

      {template.includes('{date}') && (
        <div>
          <label className="label">מבנה התאריך</label>
          <select
            className="input" value={dateFormat}
            onChange={e => setDateFormat(e.target.value as DateFormat)}
            style={{ width: '100%' }}
          >
            <option value="dd/mm/yyyy">31/12/2026</option>
            <option value="yyyy-mm-dd">2026-12-31</option>
            <option value="long">31 בדצמבר 2026</option>
          </select>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <PrimaryButton onClick={apply}>
          {pageNumbers ? 'עדכן' : 'הוסף'}
        </PrimaryButton>
        {pageNumbers && (
          <>
            <GhostButton onClick={refresh}>רענן מספור</GhostButton>
            <GhostButton onClick={remove}>הסר</GhostButton>
          </>
        )}
      </div>
    </div>
  )
}
