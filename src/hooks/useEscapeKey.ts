import { useEffect, useRef } from 'react'

/**
 * Close-on-Escape for dialogs.
 *
 * Subscribes exactly once and calls through a ref, which matters more than it
 * looks: a handler re-subscribed on every render (because the callback is a
 * fresh arrow from the parent) gets *skipped* for the keystroke that caused
 * the re-render — the DOM spec does not invoke listeners added during a
 * dispatch, and the old one was already removed. That is why Escape appeared
 * to do nothing while another window-level handler was reacting to the same
 * key.
 */
export function useEscapeKey(onEscape: () => void, active = true) {
  const cb = useRef(onEscape)
  cb.current = onEscape

  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cb.current() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])
}
