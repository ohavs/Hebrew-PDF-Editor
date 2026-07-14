import React, { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useUIStore } from './store'
import { TopToolbar } from './components/toolbar/TopToolbar'
import { HorizontalToolbar } from './components/toolbar/HorizontalToolbar'
import { MobilePropertiesDrawer } from './components/panels/MobilePropertiesDrawer'
import { LeftPanel } from './components/panels/LeftPanel'
import { RightPanel } from './components/panels/RightPanel'
import { PDFViewer } from './components/viewer/PDFViewer'
import { ToastContainer } from './components/ui/Toast'
import { SearchBar } from './components/ui/SearchBar'
import { ConfirmDialog } from './components/ui/ConfirmDialog'
import { PromptDialog } from './components/ui/PromptDialog'
import { SettingsModal } from './components/ui/SettingsModal'
import { PDFToolsMobileSheet } from './components/tools/PDFToolsMobileSheet'
import { MobileHeader } from './components/mobile/MobileHeader'
import { MobileBottomNav } from './components/mobile/MobileBottomNav'
import { useKeyboard } from './hooks/useKeyboard'
import { useSessionAutosave, useSessions } from './hooks/useSessions'
import { usePDF } from './hooks/usePDF'
import './index.css'

export default function App() {
  const { darkMode, setShowDropOverlay, settingsOpen, setSettingsOpen } = useUIStore()
  const { loadPDF } = usePDF()
  const { resumeSession } = useSessions()
  const location = useLocation()

  useKeyboard()
  useSessionAutosave()

  // Resume a saved session when navigated from the homepage
  useEffect(() => {
    const resumeId = (location.state as { resumeId?: string } | null)?.resumeId
    if (resumeId) resumeSession(resumeId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Apply dark mode class
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  // iOS keyboard avoidance: expose the keyboard height as a CSS var so
  // bottom sheets can lift above it (iOS never resizes the layout viewport).
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      document.documentElement.style.setProperty('--kb-height', `${Math.round(kb)}px`)
    }
    vv.addEventListener('resize', onResize)
    onResize()
    return () => vv.removeEventListener('resize', onResize)
  }, [])

  // Global drag-and-drop
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault()
        setShowDropOverlay(true)
      }
    }
    const onDragLeave = (e: DragEvent) => {
      if (!e.relatedTarget) setShowDropOverlay(false)
    }
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      setShowDropOverlay(false)
      const file = e.dataTransfer?.files[0]
      if (file && file.type === 'application/pdf') loadPDF(file)
    }
    document.addEventListener('dragover', onDragOver)
    document.addEventListener('dragleave', onDragLeave)
    document.addEventListener('drop', onDrop)
    return () => {
      document.removeEventListener('dragover', onDragOver)
      document.removeEventListener('dragleave', onDragLeave)
      document.removeEventListener('drop', onDrop)
    }
  }, [loadPDF, setShowDropOverlay])

  return (
    <div
      className="editor-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-surface-2)',
        color: 'var(--color-text)',
      }}
    >
      {/* Desktop top toolbar */}
      <TopToolbar />

      {/* Mobile header (replaces TopToolbar on mobile) */}
      <MobileHeader />

      {/* Desktop horizontal toolbar */}
      <HorizontalToolbar />

      {/* Main area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left panel (thumbnails + annotations, or PDF tools when toolboxOpen) */}
        <LeftPanel />

        {/* PDF Viewer canvas */}
        <PDFViewer />

        {/* Right panel (properties) */}
        <RightPanel />
      </div>

      {/* Mobile bottom navigation (replaces BottomToolbar on mobile) */}
      <MobileBottomNav />

      {/* Mobile properties drawer */}
      <MobilePropertiesDrawer />

      {/* Document search */}
      <SearchBar />

      {/* Toasts */}
      <ToastContainer />

      {/* Global confirm dialog */}
      <ConfirmDialog />

      {/* File-name prompt dialog */}
      <PromptDialog />

      {/* Mobile PDF tools bottom sheet */}
      <PDFToolsMobileSheet />

      {/* Settings modal */}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
