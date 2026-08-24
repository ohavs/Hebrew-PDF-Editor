import { useEffect } from 'react'
import { usePDFStore, useUIStore } from '../store'
import { useInsertImage, pointToPage } from './useInsertImage'

/**
 * Paste and drag-and-drop straight onto the page.
 *
 * Both land where the user is pointing when that can be worked out, and in the
 * middle of the current page otherwise. Pasting while typing is left alone —
 * inside a text box the browser's own paste is what you want.
 */
export function usePasteAndDrop(enabled = true) {
  const { insertImage, insertImageFiles, insertText } = useInsertImage()

  useEffect(() => {
    if (!enabled) return

    const lastPointer = { x: 0, y: 0 }
    const trackPointer = (e: PointerEvent) => { lastPointer.x = e.clientX; lastPointer.y = e.clientY }

    const isEditingText = () => {
      const el = document.activeElement as HTMLElement | null
      return !!el && (
        el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
      )
    }

    const onPaste = async (e: ClipboardEvent) => {
      if (!usePDFStore.getState().pageCount) return
      if (isEditingText()) return // the browser's own paste belongs to the field

      const items = Array.from(e.clipboardData?.items || [])
      const imageItems = items.filter(i => i.type.startsWith('image/'))
      const target = pointToPage(lastPointer.x, lastPointer.y)

      if (imageItems.length) {
        e.preventDefault()
        const files = imageItems.map(i => i.getAsFile()).filter((f): f is File => !!f)
        await insertImageFiles(files, target ? { pageIndex: target.pageIndex, at: target.point } : undefined)
        return
      }

      const text = e.clipboardData?.getData('text/plain')
      if (text?.trim()) {
        e.preventDefault()
        insertText(text, target ? { pageIndex: target.pageIndex, at: target.point } : undefined)
        useUIStore.getState().addToast('הטקסט הודבק — אפשר לגרור ולערוך', 'success')
      }
    }

    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
    }

    const onDrop = async (e: DragEvent) => {
      const files = Array.from(e.dataTransfer?.files || [])
      const images = files.filter(f => f.type.startsWith('image/'))
      // A dropped PDF still means "open this document" — App handles that
      if (!images.length || !usePDFStore.getState().pageCount) return
      e.preventDefault()
      // Stopping here keeps App from opening the file as a new document —
      // which also means clearing the drag overlay it put up, since its own
      // drop handler is the thing that would have done so
      e.stopPropagation()
      useUIStore.getState().setShowDropOverlay(false)
      const target = pointToPage(e.clientX, e.clientY)
      await insertImageFiles(images, target ? { pageIndex: target.pageIndex, at: target.point } : undefined)
    }

    window.addEventListener('pointermove', trackPointer)
    window.addEventListener('paste', onPaste)
    // Capture phase: this must win over App's "open the dropped file" handler
    document.addEventListener('dragover', onDragOver, true)
    document.addEventListener('drop', onDrop, true)
    return () => {
      window.removeEventListener('pointermove', trackPointer)
      window.removeEventListener('paste', onPaste)
      document.removeEventListener('dragover', onDragOver, true)
      document.removeEventListener('drop', onDrop, true)
    }
  }, [enabled, insertImage, insertImageFiles, insertText])
}
