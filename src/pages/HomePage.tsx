import React from 'react'
import { useNavigate } from 'react-router-dom'

export const HomePage: React.FC = () => {
  const navigate = useNavigate()

  return (
    <div className="page-root" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)' }}>
      <Nav />
      <Hero onOpen={() => navigate('/editor')} />
      <Features />
      <Tools />
      <Footer />
    </div>
  )
}

// ─── Nav ────────────────────────────────────────────────────────────────────
const Nav: React.FC = () => {
  const navigate = useNavigate()
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--color-border)',
      padding: '0 24px', height: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <PDFIcon size={28} />
        <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--color-text)' }}>PDF Pro</span>
        <span style={{ fontSize: 11, background: '#eff6ff', color: '#2563eb', borderRadius: 4, padding: '2px 6px', fontWeight: 600 }}>עברית</span>
      </div>
      <button
        className="btn btn-primary"
        onClick={() => navigate('/editor')}
        style={{ padding: '8px 20px', fontSize: 14 }}
      >
        פתח עורך PDF
      </button>
    </nav>
  )
}

// ─── Hero ───────────────────────────────────────────────────────────────────
const Hero: React.FC<{ onOpen: () => void }> = ({ onOpen }) => (
  <section style={{
    padding: '96px 24px 80px',
    textAlign: 'center',
    background: 'linear-gradient(180deg, #eff6ff 0%, var(--color-surface-2) 100%)',
  }}>
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 24,
      background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 20,
      padding: '4px 14px', fontSize: 13, color: '#1d4ed8', fontWeight: 500
    }}>
      <span>✦</span> חינמי לחלוטין · עובד בדפדפן · ללא העלאה לשרת
    </div>

    <h1 style={{
      fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 800, lineHeight: 1.1,
      margin: '0 0 20px', color: 'var(--color-text)',
      animation: 'fadeUp 0.5s cubic-bezier(0.23, 1, 0.32, 1) both',
    }}>
      עורך PDF עברי<br />
      <span style={{ color: 'var(--color-accent)' }}>מקצועי</span>
    </h1>

    <p style={{
      fontSize: 18, color: 'var(--color-text-muted)', maxWidth: 520, margin: '0 auto 40px',
      lineHeight: 1.7,
      animation: 'fadeUp 0.5s 0.05s cubic-bezier(0.23, 1, 0.32, 1) both',
    }}>
      ערוך, הוסף הערות, חתום וצור PDF בעברית ובאנגלית ישירות בדפדפן. ללא התקנה, ללא עלות.
    </p>

    <div style={{
      display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap',
      animation: 'fadeUp 0.5s 0.1s cubic-bezier(0.23, 1, 0.32, 1) both',
    }}>
      <button
        className="btn btn-primary"
        onClick={onOpen}
        style={{ padding: '14px 32px', fontSize: 16, borderRadius: 12 }}
      >
        <PDFIcon size={18} />
        פתח עורך PDF
      </button>
      <label
        htmlFor="hero-upload"
        className="btn btn-secondary"
        style={{ padding: '14px 32px', fontSize: 16, borderRadius: 12, cursor: 'pointer' }}
      >
        <UploadIcon />
        העלה קובץ PDF
        <input id="hero-upload" type="file" accept=".pdf" style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) {
              sessionStorage.setItem('pending-pdf-name', f.name)
              // Store in IndexedDB or pass via state — for now navigate to editor
              window.location.hash = '/editor'
            }
          }}
        />
      </label>
    </div>

    <style>{`
      @keyframes fadeUp {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `}</style>
  </section>
)

// ─── Features ───────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: '✍️', title: 'טקסט עברי', desc: 'הוסף טקסט RTL/LTR עם גופנים עבריים: Heebo, David, Frank Ruhl ועוד' },
  { icon: '🖊️', title: 'ציור חופשי', desc: 'צייר, הדגש ועצב ישירות על גבי הדף' },
  { icon: '🔖', title: 'הדגשה', desc: 'הדגש טקסט בצבעים שונים בלחיצה וגרירה' },
  { icon: '✒️', title: 'חתימה דיגיטלית', desc: 'חתום על מסמכים בחתימת יד דיגיטלית' },
  { icon: '📋', title: 'טפסים', desc: 'מלא שדות טפסים של PDF ושמור' },
  { icon: '🏷️', title: 'חותמות', desc: 'הוסף חותמות "מאושר", "סודי" ועוד' },
  { icon: '📝', title: 'פתקיות', desc: 'הוסף הערות כפתקיות לשיתוף פעולה' },
  { icon: '📄', title: 'ניהול דפים', desc: 'סדר מחדש, מחק והוסף דפים בקלות' },
]

const Features: React.FC = () => (
  <section style={{ padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
    <SectionHeader title="כל הכלים במקום אחד" subtitle="עורך PDF מלא עם תמיכה מלאה בעברית ו-RTL" />
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      gap: 16, marginTop: 48
    }}>
      {FEATURES.map((f, i) => (
        <FeatureCard key={f.title} {...f} delay={i * 40} />
      ))}
    </div>
  </section>
)

const FeatureCard: React.FC<{ icon: string; title: string; desc: string; delay: number }> = ({ icon, title, desc, delay }) => (
  <div
    style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 16, padding: '24px 20px',
      transition: 'transform 200ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow 200ms cubic-bezier(0.23, 1, 0.32, 1)',
      animation: `fadeUp 0.5s ${delay}ms cubic-bezier(0.23, 1, 0.32, 1) both`,
    }}
    onMouseEnter={e => {
      const el = e.currentTarget as HTMLDivElement
      el.style.transform = 'translateY(-4px)'
      el.style.boxShadow = '0 8px 32px rgba(37,99,235,0.12)'
    }}
    onMouseLeave={e => {
      const el = e.currentTarget as HTMLDivElement
      el.style.transform = 'translateY(0)'
      el.style.boxShadow = 'none'
    }}
  >
    <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{title}</div>
    <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>{desc}</div>
  </div>
)

// ─── Tools / Converters ─────────────────────────────────────────────────────
const TOOLS = [
  { href: '#/convert/to-image', icon: '🖼️', title: 'PDF לתמונה', desc: 'המר דפי PDF לקבצי JPEG או PNG באיכות גבוהה', color: '#8b5cf6' },
  { href: '#/convert/compress', icon: '📦', title: 'דחיסת PDF', desc: 'הקטן גודל קובץ PDF מבלי לפגוע באיכות', color: '#f97316' },
  { href: '#/convert/split', icon: '✂️', title: 'פיצול PDF', desc: 'פצל קובץ PDF לדפים נפרדים או לטווחים', color: '#22c55e' },
  { href: '#/convert/merge', icon: '🔗', title: 'מיזוג PDF', desc: 'מזג מספר קבצי PDF לקובץ אחד', color: '#ef4444' },
]

const Tools: React.FC = () => (
  <section style={{ padding: '80px 24px', background: 'var(--color-surface)' }}>
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <SectionHeader title="כלים נוספים" subtitle="המרות PDF מהירות ישירות בדפדפן" />
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 16, marginTop: 48
      }}>
        {TOOLS.map((t, i) => (
          <a key={t.title} href={t.href}
            style={{
              display: 'block', textDecoration: 'none', color: 'inherit',
              background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
              borderRadius: 16, padding: '28px 24px',
              transition: 'transform 200ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow 200ms cubic-bezier(0.23, 1, 0.32, 1)',
              animation: `fadeUp 0.5s ${i * 60}ms cubic-bezier(0.23, 1, 0.32, 1) both`,
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLAnchorElement
              el.style.transform = 'translateY(-4px)'
              el.style.boxShadow = `0 8px 32px ${t.color}26`
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLAnchorElement
              el.style.transform = 'translateY(0)'
              el.style.boxShadow = 'none'
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 12, marginBottom: 16,
              background: t.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24
            }}>{t.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{t.title}</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>{t.desc}</div>
            <div style={{ marginTop: 16, fontSize: 13, color: t.color, fontWeight: 600 }}>פתח ←</div>
          </a>
        ))}
      </div>
    </div>
  </section>
)

// ─── Footer ──────────────────────────────────────────────────────────────────
const Footer: React.FC = () => (
  <footer style={{
    padding: '40px 24px',
    borderTop: '1px solid var(--color-border)',
    textAlign: 'center',
    color: 'var(--color-text-muted)',
    fontSize: 13
  }}>
    <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <PDFIcon size={18} />
      <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>PDF Pro</span>
    </div>
    <p style={{ margin: 0 }}>עורך PDF עברי · פועל לחלוטין בדפדפן · קוד פתוח</p>
  </footer>
)

// ─── Helpers ─────────────────────────────────────────────────────────────────
const SectionHeader: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div style={{ textAlign: 'center' }}>
    <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, margin: '0 0 12px', color: 'var(--color-text)' }}>{title}</h2>
    <p style={{ fontSize: 16, color: 'var(--color-text-muted)', margin: 0 }}>{subtitle}</p>
  </div>
)

function PDFIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="2" width="13" height="17" rx="2" fill="#2563eb" opacity="0.15" />
      <rect x="3" y="2" width="13" height="17" rx="2" stroke="#2563eb" strokeWidth="1.5" fill="none" />
      <path d="M16 2l5 5h-5V2z" fill="#2563eb" opacity="0.5" />
      <path d="M16 2v5h5" stroke="#2563eb" strokeWidth="1.5" fill="none" />
      <path d="M7 10h6M7 13h4" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  )
}
