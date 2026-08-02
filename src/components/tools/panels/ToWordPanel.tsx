import React, { useState } from 'react'
import { usePDFStore, useUIStore } from '../../../store'
import { triggerDownload } from '../../../utils/pdfExport'
import { useEditedBytes } from '../../../hooks/usePageOps'
import { askFileName } from '../../ui/PromptDialog'
import { extractParagraphs, buildDocx } from '../../../utils/wordConvert'
import { Spinner, EmptyHint, InfoBar, PrimaryButton, loadEditedForRender } from '../toolsShared'

export const ToWordPanel: React.FC = () => {
  const { pdfDoc, fileName } = usePDFStore()
  const { addToast } = useUIStore()
  const [busy, setBusy] = useState(false)
  const getEdited = useEditedBytes()

  if (!pdfDoc) return <EmptyHint />

  const convert = async () => {
    const outName = await askFileName(`${fileName.replace(/\.pdf$/i, '')}.docx`, '.docx')
    if (!outName) return
    setBusy(true)
    try {
      // Extract from the edited doc so page order matches what the user sees
      const edited = await loadEditedForRender(getEdited)
      const pages = await extractParagraphs(edited)
      edited.destroy()
      const total = pages.reduce((n, p) => n + p.length, 0)
      if (total === 0) {
        addToast('לא נמצא טקסט במסמך (ייתכן שהוא סרוק כתמונה)', 'warning')
        return
      }
      const docx = buildDocx(pages)
      triggerDownload(
        new Blob([docx.buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
        outName
      )
      addToast('קובץ Word ירד בהצלחה', 'success')
    } catch (e) { console.error(e); addToast('שגיאה בהמרה לוורד', 'error') } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <InfoBar text="הטקסט מחולץ לקובץ DOCX הניתן לעריכה בוורד. עיצוב מורכב, טבלאות ותמונות לא נשמרים. מסמכים סרוקים (תמונה) — ללא טקסט לחילוץ." />
      <PrimaryButton onClick={convert} disabled={busy}>
        {busy ? <><Spinner /> ממיר…</> : 'המר ל-Word והורד'}
      </PrimaryButton>
    </div>
  )
}
