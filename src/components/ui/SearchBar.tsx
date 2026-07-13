import React, { useEffect, useRef, useState } from 'react'
import { usePDFStore, useUIStore } from '../../store'
import { searchDocument } from '../../utils/search'

const EASE = 'cubic-bezier(0.23,1,0.32,1)'

/**
 * Floating document search bar. Debounced full-text search over all
 * pages; prev/next jump between matches (navigating to their pages).
 */
export const SearchBar: React.FC = () => {
  const { pdfDoc, setCurrentPage } = usePDFStore()
  const { searchOpen, setSearchOpen, searchMatches, setSearchMatches, searchActiveIdx, setSearchActiveIdx } = useUIStore()
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const runRef = useRef<{ cancelled: boolean } | null>(null)

  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 50)
    else setQuery('')
  }, [searchOpen])

  // Debounced search
  useEffect(() => {
    if (!searchOpen || !pdfDoc) return
    if (runRef.current) runRef.current.cancelled = true
    if (!query.trim()) { setSearchMatches([]); return }
    const signal = { cancelled: false }
    runRef.current = signal
    setBusy(true)
    const t = setTimeout(async () => {
      const matches = await searchDocument(pdfDoc, query, signal)
      if (!signal.cancelled) {
        setSearchMatches(matches)
        setBusy(false)
        if (matches.length) setCurrentPage(matches[0].pageIndex)
      }
    }, 350)
    return () => { clearTimeout(t); signal.cancelled = true }
  }, [query, searchOpen, pdfDoc]) // eslint-disable-line react-hooks/exhaustive-deps

  const go = (dir: 1 | -1) => {
    if (!searchMatches.length) return
    const next = (searchActiveIdx + dir + searchMatches.length) % searchMatches.length
    setSearchActiveIdx(next)
    setCurrentPage(searchMatches[next].pageIndex)
  }

  if (!searchOpen) return null

  return (
    <div
      className="no-print"
      style={{
        position: 'fixed',
        top: 'calc(60px + env(safe-area-inset-top, 0px))',
        insetInlineStart: '50%',
        transform: 'translateX(50%)',
        zIndex: 300,
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 14,
        padding: '6px 8px',
        boxShadow: 'var(--shadow-elevated)',
        maxWidth: 'calc(100vw - 24px)',
        animation: `searchIn 0.2s ${EASE} both`,
        direction: 'rtl',
      }}
    >
      <style>{`@keyframes searchIn { from { opacity: 0; transform: translateX(50%) translateY(-8px); } to { opacity: 1; transform: translateX(50%) translateY(0); } }`}</style>
      <svg width="16" height="16" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
        <circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
      </svg>
      <input
        ref={inputRef}
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') go(e.shiftKey ? -1 : 1)
          if (e.key === 'Escape') setSearchOpen(false)
        }}
        placeholder="חיפוש במסמך…"
        style={{
          border: 'none', outline: 'none', background: 'transparent',
          color: 'var(--color-text)', fontSize: 16, width: 150, fontFamily: 'inherit',
          minHeight: 36,
        }}
      />
      <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)', minWidth: 46, textAlign: 'center', flexShrink: 0 }}>
        {busy ? '…' : searchMatches.length ? `${searchActiveIdx + 1}/${searchMatches.length}` : query.trim() ? '0' : ''}
      </span>
      <NavBtn label="הקודם" onClick={() => go(-1)} disabled={!searchMatches.length}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/></svg>
      </NavBtn>
      <NavBtn label="הבא" onClick={() => go(1)} disabled={!searchMatches.length}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
      </NavBtn>
      <NavBtn label="סגור" onClick={() => setSearchOpen(false)}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </NavBtn>
    </div>
  )
}

const NavBtn: React.FC<{ label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }> =
  ({ label, onClick, disabled, children }) => (
    <button
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 34, height: 34, borderRadius: 9, border: 'none', flexShrink: 0,
        background: 'var(--color-surface-2)', color: 'var(--color-text)',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        WebkitTapHighlightColor: 'transparent', minHeight: 0, padding: 0,
      }}
    >
      {children}
    </button>
  )
