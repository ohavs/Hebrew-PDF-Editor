import React from 'react'
import { useUIStore } from '../../store'
import { PDFToolsContent } from './PDFToolsModal'

export const PDFToolsMobileSheet: React.FC = () => {
  const { toolboxOpen, setToolboxOpen } = useUIStore()

  if (!toolboxOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="mobile-only"
        onClick={() => setToolboxOpen(false)}
        style={{
          position: 'fixed', inset: 0, zIndex: 480,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
        }}
      />
      {/* Bottom sheet */}
      <div
        className="mobile-only"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          height: '75vh', zIndex: 490,
          background: 'var(--color-surface)',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column',
          animation: 'sheetIn 0.3s cubic-bezier(0.32,0.72,0,1) both',
        }}
      >
        <style>{`
          @keyframes sheetIn {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
        `}</style>
        {/* Handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'var(--color-border)', margin: '12px auto 4px',
          flexShrink: 0,
        }} />
        <PDFToolsContent onClose={() => setToolboxOpen(false)} />
      </div>
    </>
  )
}
