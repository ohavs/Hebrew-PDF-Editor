import React, { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePDF } from '../hooks/usePDF'

export const HomePage: React.FC = () => {
  const navigate = useNavigate()
  const { loadPDF } = usePDF()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    await loadPDF(file)
    navigate('/editor')
  }

  return (
    <div
      className="page-root"
      style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)', direction: 'rtl' }}
      onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over') }}
      onDragLeave={e => { e.currentTarget.classList.remove('drag-over') }}
      onDrop={e => {
        e.preventDefault()
        e.currentTarget.classList.remove('drag-over')
        const f = e.dataTransfer.files[0]
        if (f?.type === 'application/pdf') handleFile(f)
      }}
    >
      <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--color-border)',
        padding: '0 32px', height: 58,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PDFLogo />
          <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.02em' }}>PDF Pro</span>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/editor')}
          style={{ padding: '8px 20px', fontSize: 14, borderRadius: 10 }}
        >
          פתח עורך
        </button>
      </nav>

      {/* Hero — editor CTA */}
      <section style={{ padding: '72px 32px 56px', textAlign: 'center', maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{
          fontSize: 'clamp(40px, 7vw, 72px)',
          fontWeight: 900, lineHeight: 1.05,
          margin: '0 0 20px',
          letterSpacing: '-0.03em',
          background: 'linear-gradient(135deg, var(--color-text) 0%, #2563eb 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          עורך PDF<br />בעברית
        </h1>

        <p style={{ fontSize: 18, color: 'var(--color-text-muted)', margin: '0 0 40px', lineHeight: 1.7 }}>
          ערוך, חתום, הדגש ושמור — ישירות בדפדפן
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '16px 32px', fontSize: 16, fontWeight: 700,
              background: 'var(--color-accent)', color: 'white',
              border: 'none', borderRadius: 14, cursor: 'pointer',
              boxShadow: '0 4px 24px rgba(37,99,235,0.35)',
              transition: 'transform 160ms cubic-bezier(0.23,1,0.32,1), box-shadow 160ms ease',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 32px rgba(37,99,235,0.45)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 24px rgba(37,99,235,0.35)' }}
            onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)' }}
            onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
          >
            <UploadIcon />
            העלה PDF
          </button>
          <button
            onClick={() => navigate('/editor')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '16px 32px', fontSize: 16, fontWeight: 600,
              background: 'var(--color-surface)', color: 'var(--color-text)',
              border: '1px solid var(--color-border)', borderRadius: 14, cursor: 'pointer',
              transition: 'transform 160ms cubic-bezier(0.23,1,0.32,1), background 150ms ease',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-2)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface)' }}
            onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)' }}
            onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = '' }}
          >
            פתח עורך ריק
          </button>
        </div>

        <p style={{ marginTop: 20, fontSize: 13, color: 'var(--color-text-muted)' }}>
          חינמי · ללא התקנה · הקבצים נשארים אצלך
        </p>
      </section>

      {/* Tools grid */}
      <section style={{ padding: '16px 32px 80px', maxWidth: 960, margin: '0 auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 12
        }}>
          {/* Main editor card */}
          <ToolCard
            href="#/editor"
            icon="✍️"
            title="עורך PDF"
            subtitle="טקסט · ציור · חתימה · טפסים"
            accent="#2563eb"
            featured
          />
          <ToolCard href="#/convert/to-image" icon="🖼️" title="PDF לתמונה" subtitle="JPEG / PNG" accent="#8b5cf6" />
          <ToolCard href="#/convert/compress" icon="📦" title="דחיסת PDF" subtitle="הקטן גודל קובץ" accent="#f97316" />
          <ToolCard href="#/convert/split" icon="✂️" title="פיצול PDF" subtitle="פצל לדפים נפרדים" accent="#22c55e" />
          <ToolCard href="#/convert/merge" icon="🔗" title="מיזוג PDF" subtitle="מזג מספר קבצים" accent="#ef4444" />
        </div>
      </section>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ─── Tool Card ────────────────────────────────────────────────────────────────
const ToolCard: React.FC<{
  href: string; icon: string; title: string; subtitle: string; accent: string; featured?: boolean
}> = ({ href, icon, title, subtitle, accent, featured }) => (
  <a
    href={href}
    style={{
      display: 'block', textDecoration: 'none', color: 'inherit',
      background: featured ? accent : 'var(--color-surface)',
      border: featured ? 'none' : '1px solid var(--color-border)',
      borderRadius: 16, padding: featured ? '28px 24px' : '20px 20px',
      gridColumn: featured ? 'span 2' : undefined,
      transition: 'transform 180ms cubic-bezier(0.23,1,0.32,1), box-shadow 180ms cubic-bezier(0.23,1,0.32,1)',
      position: 'relative', overflow: 'hidden',
    }}
    onMouseEnter={e => {
      const el = e.currentTarget
      el.style.transform = 'translateY(-3px)'
      el.style.boxShadow = featured ? `0 12px 40px ${accent}60` : `0 8px 24px ${accent}25`
    }}
    onMouseLeave={e => {
      const el = e.currentTarget
      el.style.transform = ''
      el.style.boxShadow = ''
    }}
    onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.98)' }}
    onMouseUp={e => { e.currentTarget.style.transform = '' }}
  >
    {featured && (
      <div style={{
        position: 'absolute', top: -20, left: -20,
        width: 120, height: 120, borderRadius: '50%',
        background: 'rgba(255,255,255,0.1)',
        pointerEvents: 'none'
      }} />
    )}
    <div style={{
      fontSize: featured ? 36 : 28,
      marginBottom: 10,
      filter: featured ? 'brightness(0) invert(1)' : undefined
    }}>{icon}</div>
    <div style={{
      fontWeight: 700, fontSize: featured ? 20 : 15,
      marginBottom: 4,
      color: featured ? 'white' : 'var(--color-text)'
    }}>{title}</div>
    <div style={{
      fontSize: 13,
      color: featured ? 'rgba(255,255,255,0.75)' : 'var(--color-text-muted)'
    }}>{subtitle}</div>
    {!featured && (
      <div style={{ marginTop: 12, fontSize: 13, color: accent, fontWeight: 600 }}>פתח →</div>
    )}
    {featured && (
      <div style={{ marginTop: 16, fontSize: 14, color: 'white', fontWeight: 600, opacity: 0.9 }}>פתח עורך ←</div>
    )}
  </a>
)

// ─── Icons ────────────────────────────────────────────────────────────────────
function PDFLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect x="2" y="2" width="16" height="22" rx="3" fill="#2563eb" opacity="0.15"/>
      <rect x="2" y="2" width="16" height="22" rx="3" stroke="#2563eb" strokeWidth="1.5" fill="none"/>
      <path d="M18 2l8 8h-8V2z" fill="#2563eb" opacity="0.4"/>
      <path d="M18 2v8h8" stroke="#2563eb" strokeWidth="1.5" fill="none"/>
      <path d="M6 12h8M6 16h5" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
    </svg>
  )
}
