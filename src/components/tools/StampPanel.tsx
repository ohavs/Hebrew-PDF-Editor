import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUIStore } from '../../store'

const STAMPS_HE = ['אושר','טיוטה','סודי','התקבל','בוטל','דחוף','לבדיקה']
const STAMPS_EN = ['APPROVED','DRAFT','CONFIDENTIAL','RECEIVED','CANCELLED','URGENT','FOR REVIEW']
const STAMP_COLORS = ['#dc2626','#2563eb','#16a34a','#d97706','#7c3aed','#0891b2']

export const StampPanel: React.FC = () => {
  const { t } = useTranslation()
  const { stampText, setStampText, stampColor, setStampColor, stampIsHebrew, setStampIsHebrew } = useUIStore()
  const [customText, setCustomText] = useState('')

  const stamps = stampIsHebrew ? STAMPS_HE : STAMPS_EN

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="panel-title">{t('tools.stamp')}</div>

      {/* Language toggle */}
      <div style={{ display: 'flex', gap: 4 }}>
        <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center', fontSize: 12,
          background: stampIsHebrew ? 'rgba(37,99,235,0.12)' : undefined,
          color: stampIsHebrew ? 'var(--color-accent)' : undefined,
          borderColor: stampIsHebrew ? 'var(--color-accent)' : undefined }}
          onClick={() => setStampIsHebrew(true)}>עברית</button>
        <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center', fontSize: 12,
          background: !stampIsHebrew ? 'rgba(37,99,235,0.12)' : undefined,
          color: !stampIsHebrew ? 'var(--color-accent)' : undefined,
          borderColor: !stampIsHebrew ? 'var(--color-accent)' : undefined }}
          onClick={() => setStampIsHebrew(false)}>English</button>
      </div>

      {/* Preset stamps */}
      <div>
        <label className="label">חותמות מוכנות</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {stamps.map(stamp => (
            <button key={stamp} className="btn btn-secondary"
              style={{ justifyContent: 'center', fontSize: 13, fontWeight: 700,
                borderColor: stampText === stamp ? 'var(--color-accent)' : undefined,
                color: stampText === stamp ? 'var(--color-accent)' : stampColor,
                background: stampText === stamp ? 'rgba(37,99,235,0.08)' : undefined }}
              onClick={() => setStampText(stamp)}>
              {stamp}
            </button>
          ))}
        </div>
      </div>

      {/* Custom text */}
      <div>
        <label className="label">{t('stamp.customText')}</label>
        <div style={{ display: 'flex', gap: 4 }}>
          <input className="input" value={customText} onChange={e => setCustomText(e.target.value)}
            placeholder="הקלד טקסט..." style={{ flex: 1 }} />
          <button className="btn btn-primary" style={{ padding: '6px 10px', fontSize: 12, flexShrink: 0 }}
            onClick={() => { if (customText) setStampText(customText) }}>הגדר</button>
        </div>
      </div>

      {/* Color */}
      <div>
        <label className="label">צבע חותמת</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STAMP_COLORS.map(c => (
            <div key={c} className={`color-swatch ${stampColor === c ? 'selected' : ''}`}
              style={{ background: c }}
              onClick={() => setStampColor(c)} />
          ))}
        </div>
      </div>

      {/* Preview */}
      <div>
        <label className="label">תצוגה מקדימה</label>
        <div style={{
          border: `2px solid ${stampColor}`, borderRadius: 4, padding: '8px 16px',
          textAlign: 'center', fontWeight: 700, fontSize: 20, color: stampColor,
          opacity: 0.8, letterSpacing: 1, transform: 'rotate(-10deg)', margin: '8px auto',
          width: 'fit-content', fontFamily: stampIsHebrew ? "'Heebo'" : 'Arial'
        }}>
          {stampText}
        </div>
      </div>
    </div>
  )
}
