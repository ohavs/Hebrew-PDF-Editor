import { useEffect, useRef } from 'react'
import { useAnnotationsStore, usePDFStore, useUIStore } from '../store'
import { embedAnnotationsIntoPdf, downloadBlob } from '../utils/pdfExport'
import { askFileName } from '../components/ui/PromptDialog'

async function saveDocument() {
  const { pdfBytes, fileName, pageInfos, pageOrder, watermark, pageNumbers } = usePDFStore.getState()
  if (!pdfBytes) return
  const { annotations, formFields } = useAnnotationsStore.getState()
  const outName = await askFileName(fileName.replace(/\.pdf$/i, '') + '-ערוך.pdf', '.pdf')
  if (!outName) return
  try {
    const result = await embedAnnotationsIntoPdf(pdfBytes, annotations, formFields, pageInfos, pageOrder, { watermark, pageNumbers })
    downloadBlob(result, outName)
    useUIStore.getState().addToast('הקובץ נשמר', 'success')
  } catch (e) {
    console.error(e)
    useUIStore.getState().addToast('שגיאה בשמירה', 'error')
  }
}

export function useKeyboard() {
  // One history entry per burst of arrow presses, not one per press
  const nudgeRepeat = useRef(false)
  const { undo, redo } = useAnnotationsStore()
  const { setZoom, zoom, setCurrentPage, currentPage, pageCount } = usePDFStore()
  const { setTool } = useUIStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'

      // Always handle Ctrl combos
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault()
            if (e.shiftKey) redo(); else undo()
            break
          case 'y':
            e.preventDefault()
            redo()
            break
          case '=': case '+':
            e.preventDefault()
            setZoom(zoom + 0.1)
            break
          case '-':
            e.preventDefault()
            setZoom(zoom - 0.1)
            break
          case '0':
            e.preventDefault()
            setZoom(1.0)
            break
          case 's':
            e.preventDefault()
            saveDocument()
            break
          case 'f':
            e.preventDefault()
            useUIStore.getState().setSearchOpen(true)
            break
          case 'd': {
            const sel = useAnnotationsStore.getState().selectedId
            if (!sel) break
            e.preventDefault()
            useAnnotationsStore.getState().pushHistory()
            useAnnotationsStore.getState().duplicateAnnotation(sel)
            break
          }
          case ']': case '[': {
            const sel = useAnnotationsStore.getState().selectedId
            if (!sel) break
            e.preventDefault()
            useAnnotationsStore.getState().pushHistory()
            useAnnotationsStore.getState().reorderAnnotation(
              sel,
              e.key === ']' ? (e.shiftKey ? 'front' : 'forward') : (e.shiftKey ? 'back' : 'backward'),
            )
            break
          }
          case 'p':
            e.preventDefault()
            window.print()
            break
        }
        return
      }

      if (isInput) return

      // With an object selected, the arrows belong to it — nudging by a point,
      // or ten with Shift, is how every layout tool behaves
      const selected = useAnnotationsStore.getState().selectedId
      if (selected && e.key.startsWith('Arrow')) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const { nudgeAnnotation, pushHistory } = useAnnotationsStore.getState()
        if (!nudgeRepeat.current) { pushHistory(); nudgeRepeat.current = true }
        if (e.key === 'ArrowRight') nudgeAnnotation(selected, step, 0)
        else if (e.key === 'ArrowLeft') nudgeAnnotation(selected, -step, 0)
        else if (e.key === 'ArrowDown') nudgeAnnotation(selected, 0, step)
        else if (e.key === 'ArrowUp') nudgeAnnotation(selected, 0, -step)
        return
      }

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault()
          setCurrentPage(currentPage + 1)
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault()
          setCurrentPage(currentPage - 1)
          break
        case 'Home':
          e.preventDefault()
          setCurrentPage(0)
          break
        case 'End':
          e.preventDefault()
          setCurrentPage(pageCount - 1)
          break
        case '+': case '=':
          setZoom(zoom + 0.1)
          break
        case '-':
          setZoom(zoom - 0.1)
          break
        case 'Escape':
          setTool('select')
          break
        case 'Delete':
        case 'Backspace': {
          const { selectedId, deleteAnnotation } = useAnnotationsStore.getState()
          if (selectedId) {
            deleteAnnotation(selectedId)
            useAnnotationsStore.getState().selectAnnotation(null)
          }
          break
        }
        // Tool shortcuts
        case 'v': setTool('select'); break
        case 't': setTool('text'); break
        case 'h': setTool('highlight'); break
        case 'd': setTool('draw'); break
        case 's': setTool('shapes'); break
        case 'n': setTool('stamp'); break
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key.startsWith('Arrow')) nudgeRepeat.current = false
    }
    window.addEventListener('keydown', handler)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', handler)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [zoom, currentPage, pageCount, undo, redo, setZoom, setCurrentPage, setTool])
}
