import React, { useState } from 'react'
import { usePDFStore, useUIStore } from '../../../store'
import { triggerDownload } from '../../../utils/pdfExport'
import { useEditedBytes } from '../../../hooks/usePageOps'
import { askFileName } from '../../ui/PromptDialog'
import { extractTables, buildXlsx } from '../../../utils/excelExport'
import { Spinner, EmptyHint, InfoBar, PrimaryButton, loadEditedForRender } from '../toolsShared'

export const ToExcelPanel: React.FC = () => {
  const { pdfDoc, fileName } = usePDFStore()
  const { addToast } = useUIStore()
  const [busy, setBusy] = useState(false)
  const getEdited = useEditedBytes()

  if (!pdfDoc) return <EmptyHint />

  const convert = async () => {
    const outName = await askFileName(`${fileName.replace(/\.pdf$/i, '')}.xlsx`, '.xlsx')
    if (!outName) return
    setBusy(true)
    try {
      // Read the edited doc so page order matches what the user sees
      const edited = await loadEditedForRender(getEdited)
      const sheets = await extractTables(edited)
      edited.destroy()
      const cells = sheets.reduce((n, s) => n + s.rows.reduce((m, r) => m + r.filter(Boolean).length, 0), 0)
      if (!cells) {
        addToast('לא נמצא טקסט במסמך (ייתכן שהוא סרוק כתמונה)', 'warning')
        return
      }
      const xlsx = buildXlsx(sheets)
      triggerDownload(
        new Blob([xlsx.buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        outName
      )
      addToast(`קובץ Excel ירד — ${sheets.length} גיליונות`, 'success')
    } catch (e) { console.error(e); addToast('שגיאה בהמרה לאקסל', 'error') } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InfoBar text="כל עמוד הופך לגיליון נפרד. השורות והעמודות נגזרות ממיקום הטקסט בדף — טבלאות רגילות (חשבוניות, דפי בנק) יוצאות טוב; תאים ממוזגים נפרסים לתאים נפרדים." />
      <PrimaryButton onClick={convert} disabled={busy}>
        {busy ? <><Spinner /> ממיר…</> : 'המר ל-Excel והורד'}
      </PrimaryButton>
    </div>
  )
}
