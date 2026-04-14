import React from 'react'
import { useNavigate } from 'react-router-dom'

interface Props {
  title: string
  subtitle: string
  icon: string
  color: string
  children: React.ReactNode
}

export const ConverterLayout: React.FC<Props> = ({ title, subtitle, icon, color, children }) => {
  const navigate = useNavigate()

  return (
    <div className="page-root" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text)' }}>
      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--color-border)',
        padding: '0 24px', height: 60,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button
          className="btn btn-secondary"
          onClick={() => navigate('/')}
          style={{ padding: '6px 12px', fontSize: 13 }}
        >
          ← חזרה
        </button>
        <div style={{ width: 1, height: 20, background: 'var(--color-border)' }} />
        <span style={{ fontSize: 24 }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: 16 }}>{title}</span>
      </nav>

      {/* Hero */}
      <div style={{
        padding: '48px 24px 32px',
        textAlign: 'center',
        background: `linear-gradient(180deg, ${color}10 0%, var(--color-surface-2) 100%)`,
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20, margin: '0 auto 16px',
          background: color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32
        }}>{icon}</div>
        <h1 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 8px', color: 'var(--color-text)' }}>{title}</h1>
        <p style={{ fontSize: 16, color: 'var(--color-text-muted)', margin: 0 }}>{subtitle}</p>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px 80px' }}>
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 20, padding: 24
        }}>
          {children}
        </div>
      </div>
    </div>
  )
}
