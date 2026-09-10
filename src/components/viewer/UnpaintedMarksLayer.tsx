import React, { useEffect, useState } from 'react'
import { usePDFStore } from '../../store'
import { marksOf, type DocumentMark } from '../../utils/documentMarks'

interface Props {
  pageIndex: number
  naturalWidth: number
  naturalHeight: number
  zoom: number
}

/** Marks worth standing in for: ones meant to be read, not little note icons. */
const DRAWN_SUBTYPES = new Set(['FreeText', 'Stamp', 'Watermark'])

/**
 * Marks the file asks for but supplies no drawing of.
 *
 * A PDF annotation is normally painted from its appearance stream, and a
 * viewer that has none paints nothing — which is why a large "DEMO VERSION"
 * stamp can be unmistakably present in the file and invisible on the page.
 * The specification allows a viewer to build an appearance from the
 * annotation's own text instead, and that is what other editors do, so this
 * draws a plain stand-in rather than leaving blank paper.
 *
 * It is deliberately marked as a stand-in — dashed, and not selectable — so it
 * is never mistaken for page content. Removing it is the marks tool's job.
 */
export const UnpaintedMarksLayer: React.FC<Props> = ({ pageIndex, naturalWidth, naturalHeight, zoom }) => {
  const { pdfDoc, pdfBytes } = usePDFStore()
  const [marks, setMarks] = useState<DocumentMark[]>([])

  useEffect(() => {
    let live = true
    if (!pdfDoc) { setMarks([]); return }
    ;(async () => {
      try {
        const all = await marksOf(pdfDoc, pdfBytes)
        if (!live) return
        setMarks(all.filter(m =>
          m.pageIndex === pageIndex &&
          !m.hasAppearance &&
          DRAWN_SUBTYPES.has(m.subtype) &&
          m.contents.length > 0 &&
          m.rect.width > 4 && m.rect.height > 4))
      } catch {
        if (live) setMarks([]) // a file whose annotations will not parse just shows none
      }
    })()
    return () => { live = false }
  }, [pdfDoc, pdfBytes, pageIndex])

  if (!marks.length) return null

  return (
    <div
      data-unpainted-marks
      style={{
        position: 'absolute', top: 0, left: 0,
        width: naturalWidth * zoom, height: naturalHeight * zoom,
        pointerEvents: 'none', zIndex: 3,
      }}
    >
      {marks.map(m => (
        <div
          key={m.ref}
          title={`${m.contents} — סימן שהגיע עם הקובץ, ללא מראה מוגדר`}
          style={{
            position: 'absolute',
            left: m.rect.x * zoom,
            top: m.rect.y * zoom,
            width: m.rect.width * zoom,
            height: m.rect.height * zoom,
            border: '1px dashed rgba(190,18,60,0.5)',
            borderRadius: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            // Fitted to the box rather than guessed from the font entry, which
            // a file like this usually does not supply either
            fontSize: Math.max(8, Math.min(m.rect.height * 0.62, m.rect.width / Math.max(4, m.contents.length) * 1.6)) * zoom,
            color: 'rgba(17,17,17,0.85)',
            fontWeight: 600,
            textAlign: 'center',
            overflow: 'hidden',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.15,
            padding: 2 * zoom,
            boxSizing: 'border-box',
          }}
        >
          {m.contents}
        </div>
      ))}
    </div>
  )
}
