import React, { useCallback, useRef, useState } from 'react'
import { usePDFStore, useUIStore, useAnnotationsStore } from '../../store'
import { findEditableLineAt, sampleLineColors, type EditableLine } from '../../utils/textEdit'
import type { TextBoxAnnotation } from '../../store/types'

interface Props {
  pageIndex: number
  naturalWidth: number
  naturalHeight: number
  zoom: number
}

/**
 * Editing the text that is already in the document.
 *
 * A PDF has no editable text objects — only glyphs painted at coordinates —
 * so a line cannot be "changed". What happens instead is what every browser
 * PDF editor does: the line is covered with the paper colour sampled from the
 * page, and a real text box carrying the same words, size and colour is put
 * on top. From there it edits, moves and exports like any other text.
 */
export const TextEditLayer: React.FC<Props> = ({ pageIndex, naturalWidth, naturalHeight, zoom }) => {
  const { pdfDoc } = usePDFStore()
  const { activeTool, addToast, setTool } = useUIStore()
  const [hover, setHover] = useState<EditableLine | null>(null)
  const busy = useRef(false)
  const lastPoint = useRef({ x: 0, y: 0 })

  const active = activeTool === 'edit-text'

  const locate = useCallback(async (clientX: number, clientY: number, el: HTMLElement) => {
    const box = el.getBoundingClientRect()
    const point = { x: (clientX - box.left) / zoom, y: (clientY - box.top) / zoom }
    lastPoint.current = point
    return findEditableLineAt(pdfDoc, pageIndex, point)
  }, [pdfDoc, pageIndex, zoom])

  const onMove = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (!active || busy.current) return
    // One lookup at a time; the page's text content is cached by pdf.js
    busy.current = true
    try {
      const hit = await locate(e.clientX, e.clientY, e.currentTarget)
      setHover(hit.kind === 'line' ? hit.line : null)
    } finally { busy.current = false }
  }

  const onClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!active) return
    e.stopPropagation()
    const hit = await locate(e.clientX, e.clientY, e.currentTarget as HTMLElement)
    if (hit.kind === 'no-text-layer') {
      // Nothing to find: the page is a picture of text, not text
      addToast('אין בדף הזה טקסט הניתן לעריכה — כנראה סריקה או תמונה. אפשר להוסיף תיבת טקסט מעל.', 'warning')
      return
    }
    if (hit.kind === 'unreadable-text') {
      // There are glyphs, but the font says nothing about which letters they are
      addToast('יש בדף טקסט, אך הגופן שבו הוא נכתב לא מאפשר לקרוא אותו. אפשר לכסות ולכתוב מחדש בעזרת תיבת טקסט.', 'warning')
      return
    }
    if (hit.kind === 'miss') { addToast('לא נמצא טקסט במקום הזה — לחץ על השורה עצמה', 'warning'); return }
    const line = hit.line

    const canvas = document.querySelector(`#page-${pageIndex} canvas.pdf-canvas`) as HTMLCanvasElement | null
    const colors = canvas
      ? sampleLineColors(canvas, line.rect, naturalWidth)
      : { text: '#111111', background: '#ffffff' }

    const { addAnnotation, selectAnnotation, pushHistory } = useAnnotationsStore.getState()
    pushHistory()
    // A hair of margin so antialiased edges of the old glyphs are covered too
    const pad = 2
    const x = Math.max(0, line.rect.x - pad)
    // The replacement is set in Heebo, which is wider than most of the fonts a
    // PDF ships with. Without a little room to spare the same words wrap to a
    // second line the moment the box appears.
    const wanted = line.rect.width * 1.18 + pad * 2
    const box: Omit<TextBoxAnnotation, 'id' | 'createdAt'> = {
      type: 'textbox',
      pageIndex,
      rect: {
        x,
        y: Math.max(0, line.rect.y - pad),
        width: Math.min(wanted, naturalWidth - x),
        height: line.rect.height + pad * 2,
      },
      content: line.text,
      fontFamily: 'Heebo',
      fontSize: line.fontSize,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textDecoration: 'none',
      color: colors.text,
      align: line.rtl ? 'right' : 'left',
      direction: line.rtl ? 'rtl' : 'ltr',
      backgroundColor: colors.background,
      padding: 1,
      lineHeight: 1.15,
    }
    const id = addAnnotation(box)
    selectAnnotation(id)
    // Open it for typing straight away — it arrives pre-filled, so the
    // empty-box auto-focus would not fire
    useUIStore.getState().setPendingEditId(id)
    setHover(null)
    // Editing continues with the ordinary text handles from here
    setTool('select')
    addToast('הטקסט נפתח לעריכה — הקלד כדי להחליף אותו', 'success')
  }

  if (!active) return null

  return (
    <div
      data-text-edit-layer
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
      onClick={onClick}
      style={{
        position: 'absolute', top: 0, left: 0,
        width: naturalWidth * zoom, height: naturalHeight * zoom,
        zIndex: 12, cursor: 'text',
      }}
    >
      {hover && (
        <div
          data-text-edit-hover
          style={{
            position: 'absolute',
            left: hover.rect.x * zoom,
            top: hover.rect.y * zoom,
            width: hover.rect.width * zoom,
            height: hover.rect.height * zoom,
            background: 'rgba(37,99,235,0.16)',
            outline: '1.5px solid var(--color-accent)',
            borderRadius: 2,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}
