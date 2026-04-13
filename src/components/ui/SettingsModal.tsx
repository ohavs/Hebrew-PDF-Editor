import React from 'react'
import { useTranslation } from 'react-i18next'
import { useUIStore } from '../../store'
import i18n from '../../i18n'

interface Props { onClose: () => void }

export const SettingsModal: React.FC<Props> = ({ onClose }) => {
  const { t } = useTranslation()
  const { language, setLanguage, darkMode, toggleDarkMode, authorName, setAuthorName,
          autoSaveInterval, setAutoSaveInterval, dateFormat, setDateFormat } = useUIStore()

  const handleLangChange = (lang: 'he' | 'en') => {
    setLanguage(lang)
    i18n.changeLanguage(lang)
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr'
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ width: 400, maxWidth: '95vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{t('settings.title')}</h2>
          <button className="btn-icon" onClick={onClose} style={{ fontSize: 20 }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Language */}
          <div>
            <label className="label">{t('settings.language')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['he','en'] as const).map(lang => (
                <button key={lang} className="btn btn-secondary"
                  style={{ flex: 1, justifyContent: 'center',
                    background: language === lang ? 'rgba(37,99,235,0.12)' : undefined,
                    borderColor: language === lang ? 'var(--color-accent)' : undefined,
                    color: language === lang ? 'var(--color-accent)' : undefined }}
                  onClick={() => handleLangChange(lang)}>
                  {lang === 'he' ? 'עברית' : 'English'}
                </button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div>
            <label className="label">{t('settings.theme')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{id: false, label: '☀️ בהיר'}, {id: true, label: '🌙 כהה'}].map(opt => (
                <button key={String(opt.id)} className="btn btn-secondary"
                  style={{ flex: 1, justifyContent: 'center',
                    background: darkMode === opt.id ? 'rgba(37,99,235,0.12)' : undefined,
                    borderColor: darkMode === opt.id ? 'var(--color-accent)' : undefined,
                    color: darkMode === opt.id ? 'var(--color-accent)' : undefined }}
                  onClick={() => { if (darkMode !== opt.id) toggleDarkMode() }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Author name */}
          <div>
            <label className="label">{t('annotation.author')}</label>
            <input className="input" value={authorName} onChange={e => setAuthorName(e.target.value)} placeholder="שמך" />
          </div>

          {/* Auto-save interval */}
          <div>
            <label className="label">{t('settings.autoSaveInterval')}: {autoSaveInterval}s</label>
            <input type="range" min="10" max="120" step="5" value={autoSaveInterval}
              onChange={e => setAutoSaveInterval(+e.target.value)} style={{ width: '100%' }} />
          </div>

          {/* Date format */}
          <div>
            <label className="label">{t('settings.dateFormat')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['gregorian','hebrew'] as const).map(f => (
                <button key={f} className="btn btn-secondary"
                  style={{ flex: 1, justifyContent: 'center',
                    background: dateFormat === f ? 'rgba(37,99,235,0.12)' : undefined,
                    borderColor: dateFormat === f ? 'var(--color-accent)' : undefined,
                    color: dateFormat === f ? 'var(--color-accent)' : undefined }}
                  onClick={() => setDateFormat(f)}>
                  {f === 'gregorian' ? t('date.gregorian') : t('date.hebrew')}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={onClose}>{t('settings.close')}</button>
        </div>
      </div>
    </div>
  )
}
