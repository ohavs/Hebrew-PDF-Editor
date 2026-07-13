import React, { useRef, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePDF } from '../hooks/usePDF'
import { useUIStore } from '../store'
import { listSessions, deleteSession, type SessionMeta } from '../utils/sessions'
import { ToastContainer } from '../components/ui/Toast'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { InstallButton } from '../components/ui/InstallButton'

// ─── Design tokens (Swiss editorial) — theme-aware via CSS variables ─────────
const C = {
  canvas: 'var(--color-canvas-mist)',
  white: 'var(--color-pure-white)',
  mist: 'var(--color-surface-mist)',
  ink: 'var(--color-ink-black)',
  steel: 'var(--color-steel-gray)',
  graphite: 'var(--color-graphite)',
  mint: 'var(--color-mint-pulse)',
  yellow: 'var(--color-electric-yellow)',
} as const

const ease = 'cubic-bezier(0.23, 1, 0.32, 1)'

// ─── Main Page ────────────────────────────────────────────────────────────────
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
      style={{
        background: C.canvas,
        minHeight: '100dvh',
        direction: 'rtl',
        fontFamily: 'var(--font-body)',
        color: C.ink,
        overflowX: 'hidden',
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

      {/* ── Nav pill ────────────────────────────────────────────────────────── */}
      <NavPill onOpenEditor={() => navigate('/editor')} />

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: 'clamp(36px, 8vw, 80px) clamp(16px, 5vw, 40px) 0' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 48,
          flexWrap: 'wrap',
        }}>
          {/* Text side (right in RTL) */}
          <div style={{ flex: '1 1 400px', minWidth: 280 }}>
            <MonoTag>עורך PDF עברי</MonoTag>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(42px, 11vw, 110px)',
              fontWeight: 700,
              lineHeight: 0.92,
              letterSpacing: '-0.03em',
              margin: '16px 0 28px',
              color: C.ink,
            }}>
              ערוך PDF<br />
              כמו{' '}
              <span style={{ color: C.yellow, WebkitTextStroke: '1px rgba(0,0,0,0.1)' }}>
                מקצוען
              </span>
            </h1>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontSize: 18,
              lineHeight: 1.5,
              color: C.graphite,
              letterSpacing: '-0.011em',
              maxWidth: 440,
              margin: '0 0 36px',
            }}>
              הדגש, חתום, ערוך והוסף טקסט — ישירות בדפדפן.
              ללא Adobe, ללא עלויות, הקבצים נשארים אצלך.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <DarkButton onClick={() => fileInputRef.current?.click()}>
                העלה PDF
              </DarkButton>
              <OutlineButton onClick={() => navigate('/editor')}>
                פתח עורך ריק
              </OutlineButton>
            </div>
            <p style={{ marginTop: 16, fontSize: 12, color: C.steel, fontFamily: 'var(--font-mono)', letterSpacing: '-0.03em' }}>
              חינמי · ללא הרשמה · פועל מקומית בדפדפן
            </p>
          </div>

          {/* Illustration side (left in RTL) */}
          <div style={{ flex: '1 1 380px', minWidth: 280, display: 'flex', justifyContent: 'center' }}>
            <PDFIllustration />
          </div>
        </div>
      </section>

      {/* ── Continue working (saved sessions) ────────────────────────────────── */}
      <SessionsSection onResume={id => navigate('/editor', { state: { resumeId: id } })} />

      {/* ── Features grid ────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1280, margin: '96px auto 0', padding: '0 clamp(16px, 5vw, 40px)' }}>
        <div style={{ marginBottom: 48 }}>
          <MonoTag>הכלים שבחרנו</MonoTag>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(48px, 6vw, 80px)',
            fontWeight: 700,
            lineHeight: 0.92,
            letterSpacing: '-0.03em',
            margin: '12px 0 0',
          }}>
            כל מה שצריך<br />
            <span style={{ color: C.yellow, WebkitTextStroke: '1px rgba(0,0,0,0.08)' }}>במקום אחד</span>
          </h2>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}>
          <FeatureCard
            icon={<TextIcon />}
            tag="עריכה"
            title="עריכת טקסט"
            body="הוסף טקסט עברי/אנגלי עם בחירת גופן, גודל, צבע וסגנון. RTL/LTR אוטומטי."
          />
          <FeatureCard
            icon={<SignatureIcon />}
            tag="חתימה"
            title="חתימה דיגיטלית"
            body="שרטט חתימה בעכבר או מגע, שמור וטען בכל מסמך עתידי."
          />
          <FeatureCard
            icon={<HighlightIcon />}
            tag="סימון"
            title="הדגשות ומרקרים"
            body="סמן טקסט בצבעים שונים, הוסף תיבות ונקודות מיקוד."
            accent={C.mint}
          />
          <FeatureCard
            icon={<ShapeIcon />}
            tag="ציור"
            title="צורות ורישום"
            body="מלבן, עיגול, חץ, קו ורישום חופשי בעט. לכל צורה: צבע, גודל, אטימות."
          />
          <FeatureCard
            icon={<StampIcon />}
            tag="חותמות"
            title="חותמות ועלים"
            body="הוסף חותמות: אושר, נדחה, סודי, לביקורת — או צור חותמת מותאמת."
            accent={C.yellow}
          />
          <FeatureCard
            icon={<PagesIcon />}
            tag="עמודים"
            title="ניהול עמודים"
            body="מחק, שכפל, סדר מחדש, סובב, מזג קבצים, הוסף דפים ריקים."
          />
        </div>
      </section>

      {/* ── Quick tools strip ────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1280, margin: '80px auto 0', padding: '0 clamp(16px, 5vw, 40px)' }}>
        <MonoTag>כלים מהירים</MonoTag>
        <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
          {[
            { href: '#/tools/merge', label: 'מיזוג PDF' },
            { href: '#/tools/split', label: 'פיצול PDF' },
            { href: '#/tools/compress', label: 'דחיסת PDF' },
            { href: '#/tools/organize', label: 'ארגון דפים' },
            { href: '#/tools/to-image', label: 'PDF → תמונה' },
            { href: '#/tools', label: 'כל הכלים' },
          ].map(item => (
            <a key={item.href} href={item.href} style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 18px',
              background: C.white,
              border: `1px solid ${C.canvas}`,
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              color: C.ink,
              textDecoration: 'none',
              letterSpacing: '-0.02em',
              transition: `background 150ms ${ease}`,
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = C.mist }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = C.white }}
            >
              {item.label}
              <span style={{ fontSize: 12, color: C.steel }}>←</span>
            </a>
          ))}
        </div>
      </section>

      {/* ── "No Adobe" section ───────────────────────────────────────────────── */}
      <section style={{
        background: C.white,
        borderRadius: 32,
        maxWidth: 1280,
        margin: '96px auto 0',
        padding: 'clamp(28px, 6vw, 64px) clamp(20px, 5vw, 56px)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 64,
          flexWrap: 'wrap',
        }}>
          <div style={{ flex: '1 1 320px' }}>
            <MonoTag>למה PDF Pro?</MonoTag>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(48px, 5vw, 72px)',
              fontWeight: 700,
              lineHeight: 0.92,
              letterSpacing: '-0.03em',
              margin: '12px 0 24px',
            }}>
              Adobe<br />
              <span style={{ color: C.yellow, WebkitTextStroke: '1px rgba(0,0,0,0.08)' }}>לא חייב</span>
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: C.graphite, maxWidth: 380, margin: '0 0 24px' }}>
              Acrobat עולה מאות שקלים בשנה. אנחנו פועלים ישירות בדפדפן — חינמי לגמרי, ללא מנוי, ללא סייג.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'עובד בעברית ובאנגלית',
                'כל הקבצים נשארים אצלך',
                'ללא הרשמה',
                'מותאם לדפדפן ולמובייל',
              ].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: C.mint, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0,
                  }}>✓</span>
                  <span style={{ fontSize: 15, letterSpacing: '-0.01em' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex: '1 1 280px', display: 'flex', justifyContent: 'center' }}>
            <ComparisonCard />
          </div>
        </div>
      </section>

      {/* ── CTA footer ───────────────────────────────────────────────────────── */}
      <section style={{
        maxWidth: 1280,
        margin: '96px auto 0',
        padding: '0 40px 80px',
        textAlign: 'center',
      }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(56px, 7vw, 96px)',
          fontWeight: 700,
          lineHeight: 0.92,
          letterSpacing: '-0.03em',
          margin: '0 0 28px',
        }}>
          מוכן להתחיל?
        </h2>
        <DarkButton onClick={() => fileInputRef.current?.click()} large>
          העלה PDF עכשיו
        </DarkButton>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: `1px solid rgba(0,0,0,0.08)`,
        padding: '24px 40px',
        maxWidth: 1280,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LogoMark />
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em' }}>PDF Pro</span>
        </div>
        <span style={{ fontSize: 12, color: C.steel, fontFamily: 'var(--font-mono)' }}>
          חינמי · קוד פתוח · עובד בדפדפן
        </span>
      </footer>

      {/* Toasts + confirm dialog (so they work on the homepage too) */}
      <ToastContainer />
      <ConfirmDialog />
    </div>
  )
}

// ─── Saved Sessions ─────────────────────────────────────────────────────────────
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
    <section style={{ maxWidth: 1280, margin: '72px auto 0', padding: '0 clamp(16px, 5vw, 40px)' }}>
      <MonoTag>המשך מהיכן שהפסקת</MonoTag>
      <h2 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'clamp(36px, 4vw, 56px)',
        fontWeight: 700, lineHeight: 0.95, letterSpacing: '-0.03em', margin: '10px 0 28px',
      }}>
        העבודות שלך
      </h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 16,
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
        borderRadius: 18,
        overflow: 'hidden',
        cursor: 'pointer',
        position: 'relative',
        boxShadow: hover ? '0 12px 32px rgba(0,0,0,0.12)' : '0 2px 10px rgba(0,0,0,0.05)',
        transform: hover ? 'translateY(-3px)' : 'translateY(0)',
        transition: `transform 220ms ${ease}, box-shadow 220ms ${ease}`,
      }}
    >
      {/* Thumbnail */}
      <div style={{
        height: 150, background: C.mist, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderBottom: `1px solid ${C.canvas}`, overflow: 'hidden',
      }}>
        {session.thumbnail
          ? <img src={session.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
          : <span style={{ fontSize: 40 }}>📄</span>}
      </div>

      {/* Delete button */}
      <button
        onClick={e => { e.stopPropagation(); onDelete() }}
        title="מחק"
        style={{
          position: 'absolute', top: 10, left: 10, width: 34, height: 34, borderRadius: '50%',
          border: 'none', background: 'rgba(255,255,255,0.92)', color: '#dc2626', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          // Always visible on touch devices (no hover there); hover-reveal on desktop
          opacity: hover || !window.matchMedia('(hover: hover)').matches ? 1 : 0,
          transform: hover ? 'scale(1)' : 'scale(0.95)',
          transition: `opacity 180ms ${ease}, transform 180ms ${ease}`,
          minHeight: 0, padding: 0,
        }}
      >
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>

      {/* Info */}
      <div style={{ padding: '14px 16px' }}>
        <div style={{
          fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{session.name}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: C.steel, fontFamily: 'var(--font-mono)' }}>
          <span>{session.pageCount} עמ׳</span>
          <span>{timeAgo(session.updatedAt)}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Nav Pill ─────────────────────────────────────────────────────────────────
const NavPill: React.FC<{ onOpenEditor: () => void }> = ({ onOpenEditor }) => (
  <div style={{ padding: '20px clamp(16px, 5vw, 40px) 0', maxWidth: 1280, margin: '0 auto' }}>
    <nav style={{
      background: C.white,
      borderRadius: 48,
      padding: '0 20px',
      height: 52,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <LogoMark />
        <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em' }}>PDF Pro</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }} className="desktop-only">
        {[
          { label: 'עורך', href: '#/editor' },
          { label: 'כלים מהירים', href: '#/tools' },
        ].map(item => (
          <a key={item.label} href={item.href} style={{
            fontSize: 14, fontWeight: 500, color: C.graphite,
            letterSpacing: '-0.02em', cursor: 'pointer', textDecoration: 'none',
          }}>{item.label}</a>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <InstallButton />
        <button
          onClick={onOpenEditor}
          style={{
            background: C.ink,
            color: C.white,
            border: 'none',
            borderRadius: 8,
            padding: '8px 20px',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            letterSpacing: '-0.02em',
            fontFamily: 'var(--font-body)',
            transition: `opacity 150ms ${ease}, transform 150ms ${ease}`,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.82' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
          onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)' }}
          onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
        >
          פתח עורך
        </button>
      </div>
    </nav>
  </div>
)

// ─── Mono Tag ─────────────────────────────────────────────────────────────────
const MonoTag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    color: C.graphite,
    letterSpacing: '-0.03em',
    display: 'inline-block',
  }}>
    {children}
  </span>
)

// ─── Dark Button ─────────────────────────────────────────────────────────────
const DarkButton: React.FC<{ onClick: () => void; children: React.ReactNode; large?: boolean }> = ({ onClick, children, large }) => (
  <button
    onClick={onClick}
    style={{
      background: C.ink,
      color: C.white,
      border: 'none',
      borderRadius: 8,
      padding: large ? '14px 36px' : '10px 24px',
      fontSize: large ? 16 : 15,
      fontWeight: 500,
      cursor: 'pointer',
      letterSpacing: '-0.02em',
      fontFamily: 'var(--font-body)',
      transition: `opacity 150ms ${ease}, transform 150ms ${ease}`,
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.82' }}
    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
    onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)' }}
    onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
  >
    {children}
  </button>
)

// ─── Outline Button ───────────────────────────────────────────────────────────
const OutlineButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      background: 'transparent',
      color: C.ink,
      border: `1.5px solid rgba(0,0,0,0.2)`,
      borderRadius: 8,
      padding: '10px 24px',
      fontSize: 15,
      fontWeight: 500,
      cursor: 'pointer',
      letterSpacing: '-0.02em',
      fontFamily: 'var(--font-body)',
      transition: `background 150ms ${ease}, border-color 150ms ${ease}, transform 150ms ${ease}`,
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.04)'
      ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,0,0,0.4)'
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
      ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,0,0,0.2)'
    }}
    onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)' }}
    onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
  >
    {children}
  </button>
)

// ─── Feature Card ─────────────────────────────────────────────────────────────
const FeatureCard: React.FC<{
  icon: React.ReactNode; tag: string; title: string; body: string; accent?: string
}> = ({ icon, tag, title, body, accent }) => (
  <div style={{
    background: C.white,
    borderRadius: 32,
    padding: '28px 28px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  }}>
    <div style={{
      width: 44,
      height: 44,
      borderRadius: 12,
      background: accent || C.mist,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {icon}
    </div>
    <MonoTag>{tag}</MonoTag>
    <div>
      <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 6 }}>{title}</div>
      <p style={{ fontSize: 14, lineHeight: 1.55, color: C.graphite, margin: 0 }}>{body}</p>
    </div>
  </div>
)

// ─── PDF Illustration ─────────────────────────────────────────────────────────
const PDFIllustration: React.FC = () => (
  <div style={{ position: 'relative', width: '100%', maxWidth: 360, aspectRatio: '360 / 460', margin: '0 auto' }}>
    {/* Main document */}
    <div style={{
      position: 'absolute',
      top: 20,
      right: 0,
      left: 20,
      bottom: 0,
      background: C.white,
      borderRadius: 12,
      padding: '24px 28px',
      boxShadow: '0 2px 24px rgba(0,0,0,0.07)',
    }}>
      {/* Header bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fca5a5' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fde68a' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#86efac' }} />
      </div>

      {/* Title line */}
      <div style={{ height: 14, width: '55%', background: C.canvas, borderRadius: 4, marginBottom: 8 }} />
      <div style={{ height: 10, width: '35%', background: '#f3f4f6', borderRadius: 4, marginBottom: 20 }} />

      {/* Highlighted block */}
      <div style={{
        background: C.yellow,
        borderRadius: 4,
        padding: '10px 14px',
        marginBottom: 16,
        opacity: 0.8,
      }}>
        <div style={{ height: 10, width: '90%', background: 'rgba(0,0,0,0.12)', borderRadius: 3, marginBottom: 6 }} />
        <div style={{ height: 10, width: '65%', background: 'rgba(0,0,0,0.10)', borderRadius: 3 }} />
      </div>

      {/* Text lines */}
      {[90, 70, 85, 55, 78].map((w, i) => (
        <div key={i} style={{ height: 8, width: `${w}%`, background: C.canvas, borderRadius: 3, marginBottom: 8 }} />
      ))}

      {/* Mint annotation */}
      <div style={{ position: 'relative', margin: '16px 0' }}>
        <div style={{
          background: C.mint,
          borderRadius: 4,
          height: 36,
          opacity: 0.7,
          display: 'flex',
          alignItems: 'center',
          paddingRight: 12,
          gap: 8,
        }}>
          <div style={{ height: 8, width: '60%', background: 'rgba(0,0,0,0.12)', borderRadius: 3 }} />
        </div>
        {/* Comment bubble */}
        <div style={{
          position: 'absolute',
          top: -8,
          left: -8,
          background: C.ink,
          color: C.white,
          borderRadius: 8,
          padding: '4px 10px',
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          whiteSpace: 'nowrap',
        }}>
          הערה: לבדיקה
        </div>
      </div>

      {/* More lines */}
      {[80, 45].map((w, i) => (
        <div key={i} style={{ height: 8, width: `${w}%`, background: C.canvas, borderRadius: 3, marginBottom: 8 }} />
      ))}

      {/* Signature area */}
      <div style={{
        border: `1.5px dashed rgba(0,0,0,0.15)`,
        borderRadius: 8,
        padding: '14px 16px',
        marginTop: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 11, color: C.steel, fontFamily: 'var(--font-mono)' }}>חתימה</span>
        <svg width="80" height="28" viewBox="0 0 80 28" fill="none">
          <path d="M4 20 Q20 4 28 14 Q36 24 44 10 Q52 -2 60 12 Q68 24 76 16"
            stroke={C.ink} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>

    {/* Floating decorative shape — yellow cube */}
    <div style={{
      position: 'absolute',
      top: 0,
      right: -12,
      width: 48,
      height: 48,
      background: C.yellow,
      borderRadius: 10,
      transform: 'rotate(12deg)',
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    }} />
    {/* Mint cube */}
    <div style={{
      position: 'absolute',
      bottom: 40,
      left: 0,
      width: 36,
      height: 36,
      background: C.mint,
      borderRadius: 8,
      transform: 'rotate(-8deg)',
    }} />
  </div>
)

// ─── Comparison Card ──────────────────────────────────────────────────────────
const ComparisonCard: React.FC = () => (
  <div style={{
    background: C.canvas,
    borderRadius: 20,
    padding: '24px',
    width: '100%',
    maxWidth: 320,
    fontFamily: 'var(--font-body)',
  }}>
    {[
      { label: 'Adobe Acrobat', price: '₪85/חודש', bad: true },
      { label: 'PDF Pro', price: 'חינמי לגמרי', bad: false },
    ].map(row => (
      <div key={row.label} style={{
        background: row.bad ? C.white : C.ink,
        color: row.bad ? C.graphite : C.white,
        borderRadius: 12,
        padding: '14px 18px',
        marginBottom: 10,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>{row.label}</span>
        <span style={{
          fontSize: 13,
          background: row.bad ? C.canvas : C.yellow,
          color: C.ink,
          borderRadius: 6,
          padding: '3px 10px',
          fontWeight: 600,
        }}>{row.price}</span>
      </div>
    ))}
    <div style={{ fontSize: 12, color: C.steel, textAlign: 'center', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
      אותן תכונות, אפס עלות
    </div>
  </div>
)

// ─── Logo ─────────────────────────────────────────────────────────────────────
const LogoMark: React.FC = () => (
  <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
    <rect x="1" y="1" width="15" height="21" rx="3" fill={C.ink} opacity="0.08"/>
    <rect x="1" y="1" width="15" height="21" rx="3" stroke={C.ink} strokeWidth="1.5" fill="none"/>
    <path d="M16 1l9 9h-9V1z" fill={C.ink} opacity="0.35"/>
    <path d="M5 10h8M5 14h5" stroke={C.ink} strokeWidth="1.5" strokeLinecap="round"/>
    <rect x="15" y="16" width="10" height="10" rx="3" fill={C.yellow}/>
    <path d="M18 21h4M20 19v4" stroke={C.ink} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

// ─── Feature Icons ────────────────────────────────────────────────────────────
const TextIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7V4h16v3M9 20h6M12 4v16"/>
  </svg>
)
const SignatureIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
    <path strokeLinecap="round" d="M3 21h18" strokeWidth="1.5"/>
  </svg>
)
const HighlightIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="14" width="18" height="5" rx="2" fill="rgba(0,0,0,0.1)"/>
    <path d="M5 14V8a7 7 0 0114 0v6" strokeLinecap="round"/>
  </svg>
)
const ShapeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1"/>
    <circle cx="17" cy="7" r="4"/>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 17l5 5 5-5"/>
  </svg>
)
const StampIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>
)
const PagesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H7m12 0a2 2 0 012 2v6a2 2 0 01-2 2H7a2 2 0 01-2-2v-6a2 2 0 012-2m12 0V9a2 2 0 00-2-2M7 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M9 7h6"/>
  </svg>
)
