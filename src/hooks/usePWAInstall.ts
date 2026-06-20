import { useState, useEffect } from 'react'

export function usePWAInstall() {
  const [prompt, setPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setIsInstalled(true))
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) setIsInstalled(true)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setIsInstalled(true)
    setPrompt(null)
  }

  return { canInstall: !!prompt && !isInstalled, isInstalled, install }
}
