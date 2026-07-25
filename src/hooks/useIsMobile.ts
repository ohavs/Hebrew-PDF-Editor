import { useEffect, useState } from 'react'

const QUERY = '(max-width: 767px)'

/**
 * Viewport check that matches the CSS .mobile-only / .desktop-only split.
 * Used to MOUNT only the relevant variant — CSS-hiding the other one still
 * runs all its effects (thumbnail renders, observers) for nothing.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(QUERY).matches)

  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const onChange = () => setIsMobile(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return isMobile
}
