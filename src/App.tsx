import React, { useEffect, useState } from 'react'
import { useUIStore } from './store'
import { TopToolbar } from './components/toolbar/TopToolbar'
import { SideToolbar, BottomToolbar } from './components/toolbar/SideToolbar'
import { LeftPanel } from './components/panels/LeftPanel'
import { RightPanel } from './components/panels/RightPanel'
import { PDFViewer } from './components/viewer/PDFViewer'
import { ToastContainer } from './components/ui/Toast'
import { SettingsModal } from './components/ui/SettingsModal'
import { useKeyboard } from './hooks/useKeyboard'
import { useAutoSave } from './hooks/useAutoSave'
import { usePDF } from './hooks/usePDF'
import './index.css'

export default function App() {
  const { darkMode, setShowDropOverlay } = useUIStore()
  const [showSettings, setShowSettings] = useState(false)
  const { loadPDF } = usePDF()

  useKeyboard()
  useAutoSave()

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

      {/* Main area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left panel (thumbnails + annotations) */}
        <LeftPanel />

        {/* Side toolbar (tools) */}
        <SideToolbar />

        {/* PDF Viewer canvas */}
        <PDFViewer />

        {/* Right panel (properties) */}
        <RightPanel />
      </div>

      {/* Mobile bottom toolbar */}
      <BottomToolbar />

      {/* Toasts */}
      <ToastContainer />

      {/* Settings modal */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
