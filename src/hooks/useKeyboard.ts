import { useEffect } from 'react'
import { useAnnotationsStore, usePDFStore, useUIStore } from '../store'

export function useKeyboard() {
  const { undo, redo } = useAnnotationsStore()
  const { setZoom, zoom, setCurrentPage, currentPage, pageCount } = usePDFStore()
  const { setTool, activeTool } = useUIStore()

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
          case 'p':
            e.preventDefault()
            window.print()
            break
        }
        return
      }

      if (isInput) return

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
        case 'n': setTool('sticky'); break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [zoom, currentPage, pageCount, undo, redo, setZoom, setCurrentPage, setTool])
}
