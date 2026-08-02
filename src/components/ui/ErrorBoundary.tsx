import React from 'react'
import { persistCurrentSession } from '../../hooks/useSessions'

interface State { hasError: boolean }

/**
 * Last line of defense: instead of a blank white screen on a render crash,
 * persist the current session and show a Hebrew recovery screen.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Fatal render error', error)
    // Best effort — save whatever the user was working on
    persistCurrentSession().catch(e => console.error('crash autosave failed', e))
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div style={{
        height: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        background: 'var(--color-surface-2)', color: 'var(--color-text)',
        padding: 24, textAlign: 'center', direction: 'rtl',
        fontFamily: "'Heebo', sans-serif",
      }}>
        <div style={{ fontSize: 48 }}>😵</div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>משהו השתבש</div>
        <div style={{ fontSize: 14, color: 'var(--color-text-muted)', maxWidth: 320, lineHeight: 1.6 }}>
          העבודה שלך נשמרה אוטומטית. טען מחדש כדי להמשיך מהיכן שהפסקת.
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '12px 32px', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: 'var(--color-accent)', color: 'var(--color-surface)',
            fontSize: 15, fontWeight: 600, fontFamily: 'inherit',
          }}
        >
          טען מחדש
        </button>
      </div>
    )
  }
}
