import React, { useRef, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAnnotationsStore, usePDFStore, useUIStore } from '../../store'
import type { SignatureAnnotation } from '../../store/types'
import SignatureCanvas from 'react-signature-canvas'

interface Props { onClose: () => void }
type Mode = 'draw' | 'upload' | 'type'

const CURSIVE_FONTS = ['Dancing Script', 'Pacifico', 'Satisfy', 'Great Vibes', 'Caveat']

export const SignatureModal: React.FC<Props> = ({ onClose }) => {
  const { t } = useTranslation()
  const sigPadRef = useRef<SignatureCanvas>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addAnnotation, pushHistory } = useAnnotationsStore()
  const { currentPage } = usePDFStore()
  const { addToast, savedSignatures, addSavedSignature, removeSavedSignature } = useUIStore()
  const [mode, setMode] = useState<Mode>('draw')
  const [typedName, setTypedName] = useState('')
  const [typedFont, setTypedFont] = useState(`'Caveat', cursive`)
  const [uploadedImg, setUploadedImg] = useState<string | null>(null)
  const [saveName, setSaveName] = useState('')
  const [showSaveInput, setShowSaveInput] = useState(false)

  useEffect(() => {
    const link = document.createElement('link')
    link.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@600&family=Dancing+Script:wght@600&family=Pacifico&family=Satisfy&family=Great+Vibes&display=swap'
    link.rel = 'stylesheet'
    document.head.appendChild(link)
    return () => { document.head.removeChild(link) }
  }, [])

  const getSignatureData = (): string | null => {
    if (mode === 'draw') {
      if (!sigPadRef.current || sigPadRef.current.isEmpty()) return null
      return sigPadRef.current.toDataURL('image/png')
    }
    if (mode === 'upload') return uploadedImg
    if (mode === 'type') {
      if (!typedName) return null
      const canvas = document.createElement('canvas')
      canvas.width = 400; canvas.height = 120
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, 400, 120)
      ctx.font = `64px ${typedFont}`
      ctx.fillStyle = '#1a2332'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(typedName, 200, 60)
      return canvas.toDataURL('image/png')
    }
    return null
  }

  const placeSignature = (imageData: string) => {
    pushHistory()
    const sig: Omit<SignatureAnnotation, 'id' | 'createdAt'> = {
      type: 'signature',
      pageIndex: currentPage,
      rect: { x: 80, y: 280, width: 220, height: 90 },
      imageData,
      rotation: 0,
    }
    addAnnotation(sig)
    addToast(t('signature.placedSignature'), 'success')
    onClose()
  }

  const handleApply = () => {
    const imageData = getSignatureData()
    if (!imageData) { addToast('אנא צור חתימה', 'warning'); return }
    placeSignature(imageData)
  }

  const handleSaveAndApply = () => {
    const imageData = getSignatureData()
    if (!imageData) { addToast('אנא צור חתימה', 'warning'); return }
    if (!saveName.trim()) { addToast('הכנס שם לחתימה', 'warning'); return }
    addSavedSignature({ name: saveName.trim(), imageData })
    addToast(`חתימה "${saveName.trim()}" נשמרה`, 'success')
    placeSignature(imageData)
  }

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setUploadedImg(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const ModeTab = ({ id, label }: { id: Mode; label: string }) => (
    <button
      onClick={() => setMode(id)}
      style={{
        flex: 1, padding: '7px 4px', border: 'none',
        background: mode === id ? 'var(--color-accent)' : 'transparent',
        color: mode === id ? 'white' : 'var(--color-text-muted)',
        borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600,
        fontFamily: 'inherit', transition: 'background 160ms ease-out, color 160ms ease-out',
      }}
      onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.96)' }}
      onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
    >{label}</button>
  )

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ width: 520, maxWidth: '96vw', padding: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '18px 20px 14px', borderBottom: '1px solid var(--color-border)',
        }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>חתימה</h2>
          <button onClick={onClose} style={{
            width: 28, height: 28, border: 'none', borderRadius: 7,
            background: 'var(--color-surface-2)', cursor: 'pointer', fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-text-muted)',
          }}>×</button>
        </div>

        <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Saved signatures */}
          {savedSignatures.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                חתימות שמורות
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {savedSignatures.map(sig => (
                  <div
                    key={sig.id}
                    style={{
                      position: 'relative',
                      border: '1px solid var(--color-border)',
                      borderRadius: 8,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'border-color 150ms ease-out, transform 150ms cubic-bezier(0.23,1,0.32,1)',
                      background: 'white',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-accent)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border)' }}
                    onMouseDown={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(0.96)' }}
                    onMouseUp={e => { (e.currentTarget as HTMLDivElement).style.transform = '' }}
                    onClick={() => placeSignature(sig.imageData)}
                    title={`השתמש ב"${sig.name}"`}
                  >
                    <img src={sig.imageData} alt={sig.name}
                      style={{ height: 52, width: 120, objectFit: 'contain', display: 'block' }} />
                    <div style={{
                      fontSize: 10, fontWeight: 500, color: 'var(--color-text-muted)',
                      textAlign: 'center', padding: '3px 6px',
                      background: 'var(--color-surface-2)',
                      borderTop: '1px solid var(--color-border)',
                    }}>{sig.name}</div>
                    <button
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); removeSavedSignature(sig.id) }}
                      style={{
                        position: 'absolute', top: 3, right: 3,
                        width: 18, height: 18, borderRadius: '50%',
                        background: 'rgba(239,68,68,0.85)', color: 'white',
                        border: 'none', cursor: 'pointer', fontSize: 11,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: 0,
                        transition: 'opacity 150ms ease',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0' }}
                    >×</button>
                  </div>
                ))}
              </div>
              <div style={{ height: 1, background: 'var(--color-border)', margin: '12px 0' }} />
            </div>
          )}

          {/* Mode selector */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--color-surface-2)', padding: 4, borderRadius: 10 }}>
            <ModeTab id="draw" label="שרטוט" />
            <ModeTab id="upload" label="העלאה" />
            <ModeTab id="type" label="הקלדה" />
          </div>

          {/* Draw mode */}
          {mode === 'draw' && (
            <div>
              <div style={{
                border: '2px dashed var(--color-border)', borderRadius: 10,
                overflow: 'hidden', touchAction: 'none', background: 'white',
                transition: 'border-color 150ms ease',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-accent)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border)' }}
              >
                <SignatureCanvas
                  ref={sigPadRef}
                  penColor="#1a2332"
                  canvasProps={{ width: 476, height: 150, className: 'sig-canvas' }}
                />
              </div>
              <button className="btn btn-ghost" style={{ marginTop: 6, fontSize: 12 }}
                onClick={() => sigPadRef.current?.clear()}>
                נקה
              </button>
            </div>
          )}

          {/* Upload mode */}
          {mode === 'upload' && (
            <div>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
              {uploadedImg ? (
                <div style={{ textAlign: 'center' }}>
                  <img src={uploadedImg} alt="חתימה"
                    style={{ maxHeight: 150, maxWidth: '100%', objectFit: 'contain',
                             border: '1px solid var(--color-border)', borderRadius: 8 }} />
                  <button className="btn btn-ghost" style={{ marginTop: 8, fontSize: 12 }}
                    onClick={() => { setUploadedImg(null); if (fileInputRef.current) fileInputRef.current.value = '' }}>
                    נקה
                  </button>
                </div>
              ) : (
                <button className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', height: 110, flexDirection: 'column', gap: 8 }}
                  onClick={() => fileInputRef.current?.click()}>
                  <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24" opacity="0.5">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                  </svg>
                  <span>העלה תמונת חתימה</span>
                </button>
              )}
            </div>
          )}

          {/* Type mode */}
          {mode === 'type' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                className="input"
                value={typedName}
                onChange={e => setTypedName(e.target.value)}
                placeholder="הכנס שם..."
                dir="auto"
                style={{ fontSize: 15 }}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {CURSIVE_FONTS.map(font => (
                  <button key={font} className="btn btn-secondary"
                    style={{
                      fontFamily: `'${font}', cursive`, fontSize: 15, padding: '4px 12px',
                      borderColor: typedFont === `'${font}', cursive` ? 'var(--color-accent)' : undefined,
                      background: typedFont === `'${font}', cursive` ? 'rgba(37,99,235,0.1)' : undefined,
                      color: typedFont === `'${font}', cursive` ? 'var(--color-accent)' : undefined,
                    }}
                    onClick={() => setTypedFont(`'${font}', cursive`)}>
                    {typedName || 'חתימה'}
                  </button>
                ))}
              </div>
              {typedName && (
                <div style={{
                  border: '1px solid var(--color-border)', borderRadius: 8,
                  padding: 16, textAlign: 'center',
                  fontFamily: typedFont, fontSize: 48, color: '#1a2332',
                  background: 'white', minHeight: 80,
                }}>
                  {typedName}
                </div>
              )}
            </div>
          )}

          {/* Save signature option */}
          <div style={{ background: 'var(--color-surface-2)', borderRadius: 8, padding: '10px 12px' }}>
            {showSaveInput ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="input"
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  placeholder="שם החתימה..."
                  style={{ flex: 1, fontSize: 13 }}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleSaveAndApply()}
                />
                <button className="btn btn-primary" style={{ fontSize: 12, flexShrink: 0 }}
                  onClick={handleSaveAndApply}>
                  שמור והוסף
                </button>
                <button className="btn btn-secondary" style={{ fontSize: 12, flexShrink: 0 }}
                  onClick={() => setShowSaveInput(false)}>
                  ביטול
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSaveInput(true)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-text-muted)', fontSize: 13, fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 6, padding: 0,
                }}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
                </svg>
                שמור חתימה זו לשימוש חוזר
              </button>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={onClose}>ביטול</button>
            <button className="btn btn-primary" onClick={handleApply}>הוסף לדף</button>
          </div>
        </div>
      </div>
    </div>
  )
}
