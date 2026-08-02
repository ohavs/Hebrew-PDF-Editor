import React, { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { usePDFStore, useUIStore } from '../../../store'
import { usePDF } from '../../../hooks/usePDF'
import { useEditedBytes } from '../../../hooks/usePageOps'
import { Spinner, EmptyHint, InfoBar, PrimaryButton } from '../toolsShared'

export const ReversePanel: React.FC = () => {
  const { pdfDoc, pageCount, fileName } = usePDFStore()
  const { addToast } = useUIStore()
  const { loadPDF } = usePDF()
  const [busy, setBusy] = useState(false)
  const getEdited = useEditedBytes()

  if (!pdfDoc) return <EmptyHint />

  const reverse = async () => {
    setBusy(true)
    try {
      const src = await PDFDocument.load(await getEdited())
      const dest = await PDFDocument.create()
      const order = Array.from({ length: pageCount }, (_, i) => pageCount - 1 - i)
      const pages = await dest.copyPages(src, order)
      pages.forEach(p => dest.addPage(p))
      await loadPDF((await dest.save()).buffer as ArrayBuffer, { name: fileName })
      addToast('סדר הדפים הופך', 'success')
    } catch { addToast('שגיאה בהיפוך סדר', 'error') } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InfoBar text={`המסמך (${pageCount} דפים) יהפוך סדר: הדף האחרון יהיה ראשון וכן הלאה.`} />
      <PrimaryButton onClick={reverse} disabled={busy}>
        {busy ? <><Spinner /> הופך…</> : `הפוך סדר ${pageCount} דפים`}
      </PrimaryButton>
    </div>
  )
}
