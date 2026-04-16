import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUIStore, usePDFStore, useAnnotationsStore } from '../../store'
import { HEBREW_FONTS, FONT_SIZES } from '../../utils/textUtils'
import { SignatureModal } from '../tools/SignatureModal'
import { StampPanel } from '../tools/StampPanel'
import { PageManagement } from './PageManagement'
import { FormsPanel } from './FormsPanel'

export const PropertiesPanel: React.FC = () => {
  const { activeTool } = useUIStore()

  switch (activeTool) {
    case 'text': return <TextProperties />
    case 'highlight': return <MarkupProperties />
    case 'draw': return <DrawProperties />
    case 'shapes': return <ShapeProperties />
    case 'stamp': return <StampPanel />
    case 'signature': return <SignatureProperties />
    case 'pages': return <PageManagement />
    case 'forms': return <FormsPanel />
    default: return <DefaultProperties />
  }
}

// Text tool properties — syncs with selected textbox when one is selected
const TextProperties: React.FC = () => {
  const { t } = useTranslation()
  const { textFont, textSize, textBold, textItalic, textUnderline, textColor, textAlign, textDirection,
          setTextFont, setTextSize, setTextBold, setTextItalic, setTextUnderline, setTextColor, setTextAlign, setTextDirection } = useUIStore()
  const { annotations, updateAnnotation, selectedId } = useAnnotationsStore()

  // If a textbox is selected, use its properties
  const selectedBox = selectedId
    ? annotations.find(a => a.id === selectedId && a.type === 'textbox') as (ReturnType<typeof annotations.find> & { fontFamily?: string; fontSize?: number; fontWeight?: string; fontStyle?: string; textDecoration?: string; color?: string; align?: string; direction?: string }) | undefined
    : undefined

  const curFont = selectedBox?.fontFamily ?? textFont
  const curSize = selectedBox?.fontSize ?? textSize
  const curBold = selectedBox ? selectedBox.fontWeight === 'bold' : textBold
  const curItalic = selectedBox ? selectedBox.fontStyle === 'italic' : textItalic
  const curUnder = selectedBox ? selectedBox.textDecoration === 'underline' : textUnderline
  const curColor = selectedBox?.color ?? textColor
  const curAlign = (selectedBox?.align ?? textAlign) as 'right'|'center'|'left'|'justify'
  const curDir = (selectedBox?.direction ?? textDirection) as 'auto'|'rtl'|'ltr'

  const update = (patch: Record<string, unknown>) => {
    if (selectedBox) updateAnnotation(selectedBox.id, patch as any)
  }

  const handleFont = (f: string) => { setTextFont(f); update({ fontFamily: f }) }
  const handleSize = (s: number) => { setTextSize(s); update({ fontSize: s }) }
  const handleBold = () => { const v = !curBold; setTextBold(v); update({ fontWeight: v ? 'bold' : 'normal' }) }
  const handleItalic = () => { const v = !curItalic; setTextItalic(v); update({ fontStyle: v ? 'italic' : 'normal' }) }
  const handleUnder = () => { const v = !curUnder; setTextUnderline(v); update({ textDecoration: v ? 'underline' : 'none' }) }
  const handleColor = (c: string) => { setTextColor(c); update({ color: c }) }
  const handleAlign = (a: 'right'|'center'|'left'|'justify') => { setTextAlign(a); update({ align: a }) }
  const handleDir = (d: 'auto'|'rtl'|'ltr') => { setTextDirection(d); update({ direction: d }) }

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="panel-title">
        {selectedBox ? 'עריכת תיבת טקסט' : t('tools.text')}
      </div>

      <div>
        <label className="label">{t('text.fontFamily')}</label>
        <select className="select" value={curFont} onChange={e => handleFont(e.target.value)} style={{ width: '100%' }}>
          {HEBREW_FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label className="label">{t('text.fontSize')}</label>
          <select className="select" value={curSize} onChange={e => handleSize(+e.target.value)} style={{ width: '100%' }}>
            {FONT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{t('text.color')}</label>
          <input type="color" value={curColor} onChange={e => handleColor(e.target.value)}
            style={{ width: 44, height: 32, padding: 2, border: '1px solid var(--color-border)', borderRadius: 6, cursor: 'pointer' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        <StyleBtn active={curBold} onClick={handleBold} title={t('text.bold')}><strong>B</strong></StyleBtn>
        <StyleBtn active={curItalic} onClick={handleItalic} title={t('text.italic')}><em>I</em></StyleBtn>
        <StyleBtn active={curUnder} onClick={handleUnder} title={t('text.underline')}><u>U</u></StyleBtn>
      </div>

      <div>
        <label className="label">{t('text.direction')}</label>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['auto','rtl','ltr'] as const).map(d => (
            <StyleBtn key={d} active={curDir === d} onClick={() => handleDir(d)}
              title={d === 'auto' ? 'אוטומטי' : d === 'rtl' ? t('text.rtl') : t('text.ltr')}>
              {d === 'auto' ? 'A' : d}
            </StyleBtn>
          ))}
        </div>
      </div>

      <div>
        <label className="label">{t('text.alignRight')}</label>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['right','center','left','justify'] as const).map(a => (
            <StyleBtn key={a} active={curAlign === a} onClick={() => handleAlign(a)}
              title={t(`text.align${a.charAt(0).toUpperCase()+a.slice(1)}`)}>
              {a === 'right' ? '⇒' : a === 'left' ? '⇐' : a === 'center' ? '⇔' : '≡'}
            </StyleBtn>
          ))}
        </div>
      </div>
    </div>
  )
}

// Markup (highlight/underline/strikethrough) properties
const MarkupProperties: React.FC = () => {
  const { t } = useTranslation()
  const { activeTool, highlightColor, highlightOpacity, setHighlightColor, setHighlightOpacity } = useUIStore()

  const COLORS = [
    { color: 'rgba(255,235,59,0.45)', label: 'צהוב' },
    { color: 'rgba(76,175,80,0.35)', label: 'ירוק' },
    { color: 'rgba(233,30,99,0.3)', label: 'ורוד' },
    { color: 'rgba(33,150,243,0.3)', label: 'כחול' },
    { color: 'rgba(255,152,0,0.35)', label: 'כתום' },
    { color: 'rgba(156,39,176,0.3)', label: 'סגול' },
  ]

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="panel-title">{t(`tools.${activeTool}`)}</div>

      <div>
        <label className="label">{t('annotation.color')}</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {COLORS.map(c => (
            <div
              key={c.color}
              className={`color-swatch ${highlightColor === c.color ? 'selected' : ''}`}
              style={{ background: c.color.replace(/[\d.]+\)$/, '0.8)'), border: highlightColor === c.color ? '2px solid var(--color-accent)' : '2px solid transparent' }}
              title={c.label}
              onClick={() => setHighlightColor(c.color)}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="label">{t('annotation.opacity')}: {Math.round(highlightOpacity * 100)}%</label>
        <input type="range" min="0.1" max="1" step="0.05" value={highlightOpacity}
          onChange={e => setHighlightOpacity(+e.target.value)} style={{ width: '100%' }} />
      </div>
    </div>
  )
}

// Draw properties
const DrawProperties: React.FC = () => {
  const { t } = useTranslation()
  const { drawColor, drawWidth, drawOpacity, setDrawColor, setDrawWidth, setDrawOpacity } = useUIStore()
  const { annotations, deleteAnnotation, pushHistory } = useAnnotationsStore()

  const COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#000000']

  const deleteLastDraw = () => {
    const draws = [...annotations].filter(a => a.type === 'draw')
    if (!draws.length) return
    pushHistory()
    deleteAnnotation(draws[draws.length - 1].id)
  }

  const drawCount = annotations.filter(a => a.type === 'draw').length

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="panel-title">{t('tools.draw')}</div>

      <div>
        <label className="label">{t('annotation.color')}</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {COLORS.map(c => (
            <div key={c} className={`color-swatch ${drawColor === c ? 'selected' : ''}`}
              style={{ background: c }}
              onClick={() => setDrawColor(c)}
            />
          ))}
          <input type="color" value={drawColor} onChange={e => setDrawColor(e.target.value)}
            style={{ width: 28, height: 28, padding: 1, border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer' }} />
        </div>
      </div>

      <div>
        <label className="label">{t('annotation.strokeWidth')}: {drawWidth}px</label>
        <input type="range" min="1" max="20" value={drawWidth}
          onChange={e => setDrawWidth(+e.target.value)} style={{ width: '100%' }} />
      </div>

      <div>
        <label className="label">{t('annotation.opacity')}: {Math.round(drawOpacity * 100)}%</label>
        <input type="range" min="0.1" max="1" step="0.05" value={drawOpacity}
          onChange={e => setDrawOpacity(+e.target.value)} style={{ width: '100%' }} />
      </div>

      <button
        className="btn btn-secondary"
        disabled={drawCount === 0}
        onClick={deleteLastDraw}
        style={{ marginTop: 4, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        מחק ציור אחרון {drawCount > 0 && `(${drawCount})`}
      </button>
    </div>
  )
}

// Shape properties
const ShapeProperties: React.FC = () => {
  const { t } = useTranslation()
  const { shapeType, shapeFill, shapeStroke, shapeWidth, setShapeType, setShapeFill, setShapeStroke, setShapeWidth } = useUIStore()

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="panel-title">{t('tools.shapes')}</div>

      <div>
        <label className="label">סוג צורה</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {(['rect','ellipse','line','arrow'] as const).map(s => (
            <StyleBtn key={s} active={shapeType === s} onClick={() => setShapeType(s)}>
              {s === 'rect' ? '□ מלבן' : s === 'ellipse' ? '○ עגול' : s === 'line' ? '― קו' : '→ חץ'}
            </StyleBtn>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <div>
          <label className="label">{t('annotation.strokeColor')}</label>
          <input type="color" value={shapeStroke} onChange={e => setShapeStroke(e.target.value)}
            style={{ width: 44, height: 32, padding: 2, border: '1px solid var(--color-border)', borderRadius: 6, cursor: 'pointer' }} />
        </div>
        <div>
          <label className="label">{t('annotation.fillColor')}</label>
          <input type="color" value={shapeFill === 'transparent' ? '#ffffff' : shapeFill}
            onChange={e => setShapeFill(e.target.value)}
            style={{ width: 44, height: 32, padding: 2, border: '1px solid var(--color-border)', borderRadius: 6, cursor: 'pointer' }} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={shapeFill === 'transparent'}
          onChange={e => setShapeFill(e.target.checked ? 'transparent' : '#ffffff')} />
        <label style={{ fontSize: 13 }}>מילוי שקוף</label>
      </div>

      <div>
        <label className="label">{t('annotation.strokeWidth')}: {shapeWidth}px</label>
        <input type="range" min="1" max="10" value={shapeWidth}
          onChange={e => setShapeWidth(+e.target.value)} style={{ width: '100%' }} />
      </div>
    </div>
  )
}

// Signature properties (launches modal)
const SignatureProperties: React.FC = () => {
  const { t } = useTranslation()
  const [showModal, setShowModal] = useState(false)
  const { pdfDoc } = usePDFStore()

  return (
    <div style={{ padding: 12 }}>
      <div className="panel-title">{t('tools.signature')}</div>
      <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}
        disabled={!pdfDoc} onClick={() => setShowModal(true)}>
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        {t('signature.draw')}
      </button>
      {showModal && <SignatureModal onClose={() => setShowModal(false)} />}
    </div>
  )
}

// Sticky note properties
const StickyProperties: React.FC = () => {
  const { t } = useTranslation()
  const { authorName, setAuthorName } = useUIStore()
  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="panel-title">{t('tools.sticky')}</div>
      <div>
        <label className="label">{t('annotation.author')}</label>
        <input className="input" value={authorName} onChange={e => setAuthorName(e.target.value)} placeholder="שמך" />
      </div>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>לחץ על הדף להוסיף פתק</p>
    </div>
  )
}

// Default / select tool
const DefaultProperties: React.FC = () => {
  const { t } = useTranslation()
  const { pdfDoc, fileName, pageCount } = usePDFStore()
  if (!pdfDoc) return (
    <div style={{ padding: 16, color: 'var(--color-text-muted)', fontSize: 13, textAlign: 'center' }}>
      <p>פתח קובץ PDF להתחלה</p>
    </div>
  )
  return (
    <div style={{ padding: 12 }}>
      <div className="panel-title">מסמך</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
        <InfoRow label="שם" value={fileName} />
        <InfoRow label="דפים" value={String(pageCount)} />
      </div>
    </div>
  )
}

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
    <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
    <span style={{ color: 'var(--color-text)', fontWeight: 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'end' }}>{value}</span>
  </div>
)

const StyleBtn: React.FC<{ active?: boolean; onClick: () => void; title?: string; children: React.ReactNode }> = ({ active, onClick, title, children }) => (
  <button className={`btn btn-secondary`}
    onClick={onClick}
    title={title}
    style={{
      fontSize: 13, padding: '5px 10px', borderRadius: 6, flex: 1,
      background: active ? 'rgba(37,99,235,0.12)' : undefined,
      borderColor: active ? 'var(--color-accent)' : undefined,
      color: active ? 'var(--color-accent)' : undefined
    }}
  >{children}</button>
)
