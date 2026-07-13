import React, { useRef, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePDF } from '../hooks/usePDF'
import { useUIStore, usePDFStore, useAnnotationsStore } from '../store'
import { listSessions, deleteSession, type SessionMeta } from '../utils/sessions'
import { ToastContainer } from '../components/ui/Toast'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { InstallButton } from '../components/ui/InstallButton'
import { TOOL_META } from './QuickTools'

// ─── Design tokens — theme-aware via CSS variables ───────────────────────────
const C = {
  canvas: 'var(--color-canvas-mist)',
  white: 'var(--color-pure-white)',
  mist: 'var(--color-surface-mist)',
  ink: 'var(--color-ink-black)',
  steel: 'var(--color-steel-gray)',
  graphite: 'var(--color-graphite)',
} as const

const ease = 'cubic-bezier(0.23, 1, 0.32, 1)'

/**
 * Launcher homepage: open/upload a document, jump straight into a quick
 * tool, or resume saved work. No marketing sections.
 */
export const HomePage: React.FC = () => {
  const navigate = useNavigate()
  const { loadPDF } = usePDF()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleFile = async (file: File) => {
    await loadPDF(file)
    navigate('/editor')
  }

  return (
    <div
      className="page-root"
      style={{
        background: C.canvas,
        direction: 'rtl',
        fontFamily: 'var(--font-body)',
        color: C.ink,
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault(); setDragging(false)
        const f = e.dataTransfer.files[0]
        if (f?.type === 'application/pdf') handleFile(f)
      }}
    >
      {dragging && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.06)',
          border: `3px dashed ${C.ink}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 48, fontWeight: 700, letterSpacing: '-0.03em' }}>
            שחרר כאן
          </span>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <div style={{ padding: '16px clamp(14px, 4vw, 32px) 0', maxWidth: 960, margin: '0 auto', width: '100%' }}>
        <nav style={{
          background: C.white,
          borderRadius: 48,
          padding: '0 16px',
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <LogoMark />
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>PDF Pro</span>
          </div>
          <InstallButton />
        </nav>
      </div>

      <div style={{ flex: 1, maxWidth: 960, margin: '0 auto', width: '100%', padding: '0 clamp(14px, 4vw, 32px) 48px' }}>

        {/* ── Document still open in the editor ──────────────────────────────── */}
        <OpenDocumentBanner />

        {/* ── Open / upload ──────────────────────────────────────────────────── */}
        <section style={{ marginTop: 'clamp(24px, 5vw, 48px)' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(34px, 8vw, 56px)',
            fontWeight: 700,
            lineHeight: 0.95,
            letterSpacing: '-0.03em',
            margin: '0 0 20px',
            color: C.ink,
          }}>
            עורך PDF עברי
          </h1>

          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: C.white,
              border: `2px dashed ${dragging ? C.ink : 'var(--color-border)'}`,
              borderRadius: 20,
              padding: 'clamp(22px, 5vw, 36px) 20px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: `border-color 180ms ${ease}, transform 150ms ${ease}`,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.ink }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border)' }}
            onTouchStart={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(0.99)' }}
            onTouchEnd={e => { (e.currentTarget as HTMLDivElement).style.transform = '' }}
          >
            <div style={{ fontSize: 34, marginBottom: 10 }}>📄</div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>העלה PDF לעריכה</div>
            <div style={{ fontSize: 13, color: C.steel, marginTop: 6 }}>
              לחץ לבחירה או גרור לכאן · הקבצים נשארים אצלך במכשיר
            </div>
          </div>

          <button
            onClick={() => navigate('/editor')}
            style={{
              marginTop: 12,
              width: '100%',
              background: 'transparent',
              border: `1.5px solid var(--color-border)`,
              color: C.graphite,
              borderRadius: 14,
              padding: '13px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: `border-color 150ms ease, transform 150ms ${ease}`,
              WebkitTapHighlightColor: 'transparent',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.ink }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)' }}
            onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.99)' }}
            onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
          >
            פתח עורך ריק
          </button>
        </section>

        {/* ── Quick tools ────────────────────────────────────────────────────── */}
        <section style={{ marginTop: 40 }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12, fontWeight: 500, color: C.steel,
            letterSpacing: '0.04em', marginBottom: 14,
          }}>
            כלים מהירים
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
            {TOOL_META.map(t => (
              <button
                key={t.id}
                onClick={() => navigate(`/tools/${t.id}`)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
                  padding: '14px 14px', borderRadius: 16,
                  border: '1px solid transparent',
                  background: C.white,
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'start',
                  transition: `transform 140ms ${ease}, border-color 140ms ease`,
                  WebkitTapHighlightColor: 'transparent',
                  minHeight: 0,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.ink }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent' }}
                onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)' }}
                onTouchEnd={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
              >
                <span style={{ fontSize: 24 }}>{t.emoji}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{t.label}</span>
                <span style={{ fontSize: 11.5, color: C.steel, lineHeight: 1.35 }}>{t.desc}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ── Saved sessions ─────────────────────────────────────────────────── */}
        <SessionsSection onResume={id => navigate('/editor', { state: { resumeId: id } })} />

        {/* ── Footer line ────────────────────────────────────────────────────── */}
        <div style={{
          marginTop: 48, textAlign: 'center',
          fontSize: 12, color: C.steel, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em',
        }}>
          חינמי · ללא הרשמה · פועל מקומית בדפדפן
        </div>
      </div>

      <ToastContainer />
      <ConfirmDialog />
    </div>
  )
}

// ─── Open document banner ─────────────────────────────────────────────────────
const OpenDocumentBanner: React.FC = () => {
  const navigate = useNavigate()
  const { pdfDoc, fileName, pageCount, clearPdf } = usePDFStore()
  if (!pdfDoc) return null

  const closeDoc = () => {
    clearPdf()
    useAnnotationsStore.setState({ annotations: [], formFields: [], past: [], future: [], selectedId: null })
  }

  return (
    <div style={{
      marginTop: 20,
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      background: 'var(--color-mint-pulse)',
      borderRadius: 16, padding: '12px 14px',
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>📄</span>
      <div style={{ flex: 1, minWidth: 140 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          מסמך פתוח: {fileName}
        </div>
        <div style={{ fontSize: 11, color: C.steel }}>{pageCount} עמודים · העריכה נשמרת אוטומטית</div>
      </div>
      <button className="btn btn-primary" style={{ fontSize: 12.5, flexShrink: 0 }} onClick={() => navigate('/editor')}>
        המשך עריכה
      </button>
      <button className="btn btn-secondary" style={{ fontSize: 12.5, flexShrink: 0 }} onClick={closeDoc}>
        סגור מסמך
      </button>
    </div>
  )
}

// ─── Saved sessions ───────────────────────────────────────────────────────────
function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'הרגע'
  if (min < 60) return `לפני ${min} דק׳`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `לפני ${hr} שע׳`
  const days = Math.floor(hr / 24)
  if (days === 1) return 'אתמול'
  if (days < 30) return `לפני ${days} ימים`
  return new Date(ts).toLocaleDateString('he-IL')
}

const SessionsSection: React.FC<{ onResume: (id: string) => void }> = ({ onResume }) => {
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [loaded, setLoaded] = useState(false)
  const { confirm, addToast } = useUIStore()

  const refresh = useCallback(async () => {
    setSessions(await listSessions())
    setLoaded(true)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleDelete = async (s: SessionMeta) => {
    const ok = await confirm({
      title: 'מחיקת עבודה שמורה',
      message: `"${s.name}" יימחק לצמיתות מהמכשיר. לא ניתן לשחזר פעולה זו.`,
      confirmLabel: 'מחק',
      danger: true,
    })
    if (!ok) return
    await deleteSession(s.id)
    addToast('העבודה נמחקה', 'success')
    refresh()
  }

  if (!loaded || sessions.length === 0) return null

  return (
    <section style={{ marginTop: 40 }}>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 12, fontWeight: 500, color: C.steel,
        letterSpacing: '0.04em', marginBottom: 14,
      }}>
        המשך מהיכן שהפסקת
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 12,
      }}>
        {sessions.map(s => (
          <SessionCard key={s.id} session={s} onResume={() => onResume(s.id)} onDelete={() => handleDelete(s)} />
        ))}
      </div>
    </section>
  )
}

const SessionCard: React.FC<{ session: SessionMeta; onResume: () => void; onDelete: () => void }> = ({ session, onResume, onDelete }) => {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onResume}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: C.white,
        borderRadius: 16,
        overflow: 'hidden',
        cursor: 'pointer',
        position: 'relative',
        boxShadow: hover ? '0 12px 32px rgba(0,0,0,0.12)' : '0 2px 10px rgba(0,0,0,0.05)',
        transform: hover ? 'translateY(-3px)' : 'translateY(0)',
        transition: `transform 220ms ${ease}, box-shadow 220ms ${ease}`,
      }}
    >
      <div style={{
        height: 120, background: C.mist, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderBottom: `1px solid ${C.canvas}`, overflow: 'hidden',
      }}>
        {session.thumbnail
          ? <img src={session.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
          : <span style={{ fontSize: 36 }}>📄</span>}
      </div>

      <button
        onClick={e => { e.stopPropagation(); onDelete() }}
        title="מחק"
        style={{
          position: 'absolute', top: 8, left: 8, width: 34, height: 34, borderRadius: '50%',
          border: 'none', background: 'rgba(255,255,255,0.92)', color: '#dc2626', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          opacity: hover || !window.matchMedia('(hover: hover)').matches ? 1 : 0,
          transition: `opacity 180ms ${ease}`,
          minHeight: 0, padding: 0,
        }}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>

      <div style={{ padding: '12px 14px' }}>
        <div style={{
          fontSize: 13.5, fontWeight: 600, color: C.ink, marginBottom: 4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{session.name}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.steel, fontFamily: 'var(--font-mono)' }}>
          <span>{session.pageCount} עמ׳</span>
          <span>{timeAgo(session.updatedAt)}</span>
        </div>
      </div>
    </div>
  )
}

const LogoMark = () => (
  <div style={{
    width: 30, height: 30, borderRadius: 9,
    background: C.ink,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  }}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-pure-white)" strokeWidth="2.2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
    </svg>
  </div>
)
