import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useUIStore } from './store'
import { TopToolbar } from './components/toolbar/TopToolbar'
import { HorizontalToolbar } from './components/toolbar/HorizontalToolbar'
import { MobilePropertiesDrawer } from './components/panels/MobilePropertiesDrawer'
import { LeftPanel } from './components/panels/LeftPanel'
import { RightPanel } from './components/panels/RightPanel'
import { PDFViewer } from './components/viewer/PDFViewer'
import { ToastContainer } from './components/ui/Toast'
import { ConfirmDialog } from './components/ui/ConfirmDialog'
import { SettingsModal } from './components/ui/SettingsModal'
import { PDFToolsModal } from './components/tools/PDFToolsModal'
import { useKeyboard } from './hooks/useKeyboard'
import { useSessionAutosave, useSessions } from './hooks/useSessions'
import { usePDF } from './hooks/usePDF'
import './index.css'

export default function App() {
  const { darkMode, setShowDropOverlay } = useUIStore()
  const [showSettings, setShowSettings] = useState(false)
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
      {/* Top toolbar */}
      <TopToolbar />

      {/* Horizontal tool bar */}
      <HorizontalToolbar />

      {/* Main area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left panel (thumbnails + annotations) */}
        <LeftPanel />

        {/* PDF Tools panel (inline, renders when toolboxOpen) */}
        <PDFToolsModal />

        {/* PDF Viewer canvas */}
        <PDFViewer />

        {/* Right panel (properties) */}
        <RightPanel />
      </div>

      {/* Mobile properties drawer */}
      <MobilePropertiesDrawer />

      {/* Toasts */}
      <ToastContainer />

      {/* Global confirm dialog */}
      <ConfirmDialog />

      {/* Settings modal */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
