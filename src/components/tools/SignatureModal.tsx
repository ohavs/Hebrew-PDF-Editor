import React, { useRef, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAnnotationsStore, usePDFStore, useUIStore } from '../../store'
import type { SignatureAnnotation } from '../../store/types'
import SignatureCanvas from 'react-signature-canvas'

interface Props {
  onClose: () => void
}

type Mode = 'draw' | 'upload' | 'type'

const CURSIVE_FONTS = ['Dancing Script', 'Pacifico', 'Satisfy', 'Great Vibes', 'Caveat', 'Homemade Apple']
const TYPED_FONT = "'Caveat', cursive"

export const SignatureModal: React.FC<Props> = ({ onClose }) => {
  const { t } = useTranslation()
  const sigPadRef = useRef<SignatureCanvas>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addAnnotation, pushHistory } = useAnnotationsStore()
  const { currentPage } = usePDFStore()
  const { authorName, addToast } = useUIStore()
  const [mode, setMode] = useState<Mode>('draw')
  const [typedName, setTypedName] = useState(authorName || '')
  const [typedFont, setTypedFont] = useState(TYPED_FONT)
  const [uploadedImg, setUploadedImg] = useState<string | null>(null)

  // Load Google Fonts for typed signature
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
      // Render typed name to canvas
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

  const handleApply = () => {
    const imageData = getSignatureData()
    if (!imageData) { addToast('אנא צייר חתימה', 'warning'); return }
    pushHistory()
    const sig: Omit<SignatureAnnotation, 'id' | 'createdAt'> = {
      type: 'signature',
      pageIndex: currentPage,
      rect: { x: 100, y: 300, width: 200, height: 80 },
      imageData,
      rotation: 0,
      author: authorName
    }
    addAnnotation(sig)
    addToast(t('signature.placedSignature'), 'success')
    onClose()
  }

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setUploadedImg(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ width: 480, maxWidth: '95vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{t('tools.signature')}</h2>
          <button className="btn-icon" onClick={onClose}>×</button>
        </div>

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {(['draw','upload','type'] as Mode[]).map(m => (
            <button key={m} className="btn btn-secondary"
              style={{ flex: 1, justifyContent: 'center', fontSize: 12,
                background: mode === m ? 'rgba(37,99,235,0.12)' : undefined,
                borderColor: mode === m ? 'var(--color-accent)' : undefined,
                color: mode === m ? 'var(--color-accent)' : undefined }}
              onClick={() => setMode(m)}>
              {m === 'draw' ? t('signature.draw') : m === 'upload' ? t('signature.upload') : t('signature.type')}
            </button>
          ))}
        </div>

        {/* Draw mode */}
        {mode === 'draw' && (
          <div>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>{t('signature.drawHere')}</p>
            <div className="sig-pad-wrap" style={{ border: '2px dashed var(--color-border)', borderRadius: 8, overflow: 'hidden', touchAction: 'none' }}>
              <SignatureCanvas
                ref={sigPadRef}
                penColor="#1a2332"
                canvasProps={{ width: 430, height: 160, className: 'sig-canvas' }}
              />
            </div>
            <button className="btn btn-ghost" style={{ marginTop: 8, fontSize: 12 }} onClick={() => sigPadRef.current?.clear()}>
              {t('signature.clear')}
            </button>
          </div>
        )}

        {/* Upload mode */}
        {mode === 'upload' && (
          <div>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>{t('signature.uploadSig')}</p>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
            {uploadedImg ? (
              <div style={{ position: 'relative', textAlign: 'center' }}>
                <img src={uploadedImg} alt="חתימה" style={{ maxHeight: 160, maxWidth: '100%', objectFit: 'contain', border: '1px solid var(--color-border)', borderRadius: 8 }} />
                <button className="btn btn-ghost" style={{ marginTop: 8, display: 'block', width: '100%', fontSize: 12 }} onClick={() => { setUploadedImg(null); fileInputRef.current!.value = '' }}>
                  {t('signature.clear')}
                </button>
              </div>
            ) : (
              <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', height: 120 }} onClick={() => fileInputRef.current?.click()}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
                  <div>{t('signature.upload')}</div>
                </div>
              </button>
            )}
          </div>
        )}

        {/* Type mode */}
        {mode === 'type' && (
          <div>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>{t('signature.typeName')}</p>
            <input
              className="input" style={{ marginBottom: 12, direction: 'ltr', fontSize: 16 }}
              value={typedName}
              onChange={e => setTypedName(e.target.value)}
              placeholder="Your Name"
              dir="ltr"
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {CURSIVE_FONTS.map(font => (
                <button key={font} className="btn btn-secondary"
                  style={{ fontFamily: `'${font}', cursive`, fontSize: 14, padding: '4px 10px',
                    borderColor: typedFont === `'${font}', cursive` ? 'var(--color-accent)' : undefined,
                    background: typedFont === `'${font}', cursive` ? 'rgba(37,99,235,0.1)' : undefined }}
                  onClick={() => setTypedFont(`'${font}', cursive`)}>
                  {typedName || 'שם'}
                </button>
              ))}
            </div>
            {typedName && (
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 16, textAlign: 'center',
                            fontFamily: typedFont, fontSize: 48, color: '#1a2332', background: 'white', minHeight: 80 }}>
                {typedName}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>{t('errors.cancel')}</button>
          <button className="btn btn-primary" onClick={handleApply}>
            {t('signature.apply')}
          </button>
        </div>
      </div>
    </div>
  )
}
