import { useEffect, useRef } from 'react'
import { usePDFStore, useAnnotationsStore, useUIStore } from '../store'

export function useAutoSave() {
  const { fileName, hasUnsavedChanges } = usePDFStore()
  const { saveToStorage } = useAnnotationsStore()
  const { autoSaveInterval } = useUIStore()
  const timerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!fileName) return
    if (timerRef.current) clearInterval(timerRef.current)

    timerRef.current = setInterval(() => {
      if (hasUnsavedChanges) {
        saveToStorage(fileName)
        usePDFStore.getState().setHasUnsavedChanges(false)
        // Silently auto-save without toast to avoid noise
      }
    }, autoSaveInterval * 1000) as unknown as number

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [fileName, autoSaveInterval, hasUnsavedChanges])
}
