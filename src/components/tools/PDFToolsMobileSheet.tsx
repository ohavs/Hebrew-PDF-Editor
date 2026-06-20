import React from 'react'
import { useUIStore } from '../../store'
import { PDFToolsContent } from './PDFToolsModal'
import type { CategoryId } from './PDFToolsModal'

const EASE = 'cubic-bezier(0.32,0.72,0,1)'

export const PDFToolsMobileSheet: React.FC = () => {
  const { toolboxOpen, setToolboxOpen, toolboxCategory } = useUIStore()

  if (!toolboxOpen) return null

  return (
    <>
      <div
        className="mobile-only"
        onClick={() => setToolboxOpen(false)}
        style={{
          position: 'fixed', inset: 0, zIndex: 480,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />
      <div
        className="mobile-only"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          height: '80vh', zIndex: 490,
          background: 'var(--color-surface)',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column',
          animation: `sheetIn 0.3s ${EASE} both`,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'var(--color-border)', margin: '12px auto 4px',
          flexShrink: 0,
        }} />
        <PDFToolsContent
          onClose={() => setToolboxOpen(false)}
          initialCategory={toolboxCategory as CategoryId}
        />
      </div>
    </>
  )
}
