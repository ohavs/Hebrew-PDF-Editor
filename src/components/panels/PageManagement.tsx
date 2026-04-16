import React, { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { usePDFStore, useUIStore } from '../../store'
import { PDFDocument } from 'pdf-lib'
import { embedAnnotationsIntoPdf, downloadBlob } from '../../utils/pdfExport'
import { useAnnotationsStore } from '../../store'
import { usePDF } from '../../hooks/usePDF'

export const PageManagement: React.FC = () => {
  const { t } = useTranslation()
  const { pdfDoc, pdfBytes, currentPage, pageCount, pageOrder, rotatePage, reorderPages, fileName, pageInfos, setPdfDoc } = usePDFStore()
  const { annotations, formFields } = useAnnotationsStore()
  const { addToast } = useUIStore()
  const { loadPDF } = usePDF()
  const mergeInputRef = useRef<HTMLInputElement>(null)

  if (!pdfDoc) return (
    <div style={{ padding: 16, color: 'var(--color-text-muted)', fontSize: 13, textAlign: 'center' }}>
      פתח קובץ PDF להתחלה
    </div>
  )

  const handleRotate = (degrees: number) => {
    rotatePage(currentPage, degrees)
    addToast(`דף ${currentPage + 1} סובב ${degrees}°`, 'success')
  }

  const handleDeletePage = async () => {
    if (pageCount <= 1) { addToast('לא ניתן למחוק את הדף היחיד', 'error'); return }
    if (!confirm(t('pages.confirmDelete'))) return

    try {
      const doc = await PDFDocument.load(pdfBytes!)
      const newDoc = await PDFDocument.create()
      const order = pageOrder.filter((_, i) => i !== currentPage)
      const pages = await newDoc.copyPages(doc, order)
      pages.forEach(p => newDoc.addPage(p))
      const newBytes = await newDoc.save()
      await loadPDF(newBytes.buffer as ArrayBuffer)
      addToast('דף נמחק', 'success')
    } catch { addToast('שגיאה במחיקת הדף', 'error') }
  }

  const handleDuplicate = async () => {
    try {
      const doc = await PDFDocument.load(pdfBytes!)
      const newDoc = await PDFDocument.create()
      const allPages = await newDoc.copyPages(doc, pageOrder)
      allPages.forEach((p, i) => {
        newDoc.addPage(p)
        if (i === currentPage) {
          // Insert duplicate after current
          const [dup] = newDoc.getPages().slice(-1)
          // Actually re-copy
        }
      })
      // Simple: copy page and insert after current
      const srcDoc = await PDFDocument.load(pdfBytes!)
      const destDoc = await PDFDocument.create()
      const newOrder = [...pageOrder]
      newOrder.splice(currentPage + 1, 0, pageOrder[currentPage])
      const copied = await destDoc.copyPages(srcDoc, newOrder)
      copied.forEach(p => destDoc.addPage(p))
      const newBytes = await destDoc.save()
      await loadPDF(newBytes.buffer as ArrayBuffer)
      addToast('דף שוכפל', 'success')
    } catch { addToast('שגיאה בשכפול', 'error') }
  }

  const handleAddBlank = async () => {
    try {
      const doc = await PDFDocument.load(pdfBytes!)
      const info = pageInfos[currentPage]
      const newPage = doc.insertPage(currentPage + 1, [info?.width || 595, info?.height || 842])
      const newBytes = await doc.save()
      await loadPDF(newBytes.buffer as ArrayBuffer)
      addToast('דף ריק הוסף', 'success')
    } catch { addToast('שגיאה בהוספת דף', 'error') }
  }

  const handleExtract = async () => {
    try {
      const srcDoc = await PDFDocument.load(pdfBytes!)
      const newDoc = await PDFDocument.create()
      const [page] = await newDoc.copyPages(srcDoc, [pageOrder[currentPage]])
      newDoc.addPage(page)
      const newBytes = await newDoc.save()
      downloadBlob(newBytes, `page-${currentPage + 1}.pdf`)
      addToast('דף חולץ', 'success')
    } catch { addToast('שגיאה בחילוץ', 'error') }
  }

  const handleMerge = async (file: File) => {
    try {
      const srcDoc = await PDFDocument.load(pdfBytes!)
      const mergeDoc = await PDFDocument.load(await file.arrayBuffer())
      const pages = await srcDoc.copyPages(mergeDoc, mergeDoc.getPageIndices())
      pages.forEach(p => srcDoc.addPage(p))
      const newBytes = await srcDoc.save()
      await loadPDF(newBytes.buffer as ArrayBuffer)
      addToast(`${file.name} מוזג`, 'success')
    } catch { addToast('שגיאה במיזוג', 'error') }
  }

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="panel-title">{t('tools.pages')}</div>
      {/* Selected page indicator */}
      <div style={{
        background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)',
        borderRadius: 8, padding: '8px 10px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <svg width="14" height="14" fill="none" stroke="var(--color-accent)" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
        </svg>
        <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>דף {currentPage + 1}</span>
        <span style={{ color: 'var(--color-text-muted)' }}>מתוך {pageCount}</span>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginRight: 'auto' }}>לחץ על דף לבחירה</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <ActionBtn icon="↻" label={t('pages.rotate90')} onClick={() => handleRotate(90)} />
        <ActionBtn icon="↺" label={t('pages.rotate180')} onClick={() => handleRotate(180)} />
        <ActionBtn icon="⧉" label={t('pages.duplicate')} onClick={handleDuplicate} />
        <ActionBtn icon="+" label={t('pages.addBlank')} onClick={handleAddBlank} />
        <ActionBtn icon="↑" label={t('pages.extract')} onClick={handleExtract} />
        <ActionBtn icon="🗑" label={t('pages.delete')} onClick={handleDeletePage} danger />
      </div>

      <div className="divider" />

      <div>
        <label className="label">{t('pages.merge')}</label>
        <input ref={mergeInputRef} type="file" accept=".pdf" style={{ display: 'none' }}
          onChange={e => { if (e.target.files?.[0]) handleMerge(e.target.files[0]) }} />
        <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}
          onClick={() => mergeInputRef.current?.click()}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('pages.merge')}
        </button>
      </div>
    </div>
  )
}

const ActionBtn: React.FC<{ icon: string; label: string; onClick: () => void; danger?: boolean }> = ({ icon, label, onClick, danger }) => (
  <button className="btn btn-secondary" onClick={onClick}
    style={{ fontSize: 11, padding: '6px 8px', justifyContent: 'center', flexDirection: 'column', gap: 2, height: 52, color: danger ? 'var(--color-danger)' : undefined }}>
    <span style={{ fontSize: 16 }}>{icon}</span>
    <span>{label}</span>
  </button>
)
