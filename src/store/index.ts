import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type {
  ToolType, ViewMode, SidePanel, Annotation, FormField,
  PageInfo, HistoryEntry, AlignType, ShapeType, HighlightColor
} from './types'
import { ensureAnnotationFonts } from '../utils/textUtils'

const MAX_HISTORY = 50
const MAX_RECENT = 10

// ────────────────────────────────────────────────
// UI Store
// ────────────────────────────────────────────────
interface UIState {
  activeTool: ToolType
  sidePanel: SidePanel
  rightPanelOpen: boolean
  darkMode: boolean
  isFullscreen: boolean
  isMobileMenuOpen: boolean
  showDropOverlay: boolean
  toasts: Array<{ id: string; message: string; type: 'info'|'success'|'error'|'warning' }>
  toolboxOpen: boolean
  toolboxCategory: string
  settingsOpen: boolean
  searchOpen: boolean
  searchMatches: Array<{ pageIndex: number; rect: { x: number; y: number; width: number; height: number }; snippet: string }>
  searchActiveIdx: number
  /** Merge tool file list — lives in the store so switching tools keeps it */
  mergeItems: Array<{ id: string; kind: 'current' } | { id: string; kind: 'file'; file: File }>
  confirmDialog: {
    open: boolean
    title: string
    message: string
    confirmLabel: string
    cancelLabel: string
    danger: boolean
    resolve: ((v: boolean) => void) | null
  }

  // Tool properties
  drawColor: string
  drawWidth: number
  drawOpacity: number
  shapeType: ShapeType
  shapeFill: string
  shapeStroke: string
  shapeWidth: number
  highlightColor: string
  highlightOpacity: number
  stampText: string
  stampColor: string
  stampIsHebrew: boolean

  // Text tool
  textFont: string
  textSize: number
  textBold: boolean
  textItalic: boolean
  textUnderline: boolean
  textColor: string
  textAlign: AlignType
  textDirection: 'rtl' | 'ltr' | 'auto'

  // Settings
  authorName: string
  autoSaveInterval: number
  dateFormat: 'gregorian' | 'hebrew'

  // Saved signatures
  savedSignatures: Array<{ id: string; name: string; imageData: string }>
  addSavedSignature: (sig: { name: string; imageData: string }) => void
  removeSavedSignature: (id: string) => void

  setTool: (tool: ToolType) => void
  setSidePanel: (panel: SidePanel) => void
  toggleSidePanel: (panel: SidePanel) => void
  setRightPanelOpen: (open: boolean) => void
  toggleDarkMode: () => void
  setFullscreen: (v: boolean) => void
  setMobileMenuOpen: (v: boolean) => void
  setShowDropOverlay: (v: boolean) => void
  addToast: (message: string, type?: 'info'|'success'|'error'|'warning') => void
  removeToast: (id: string) => void
  setToolboxOpen: (v: boolean) => void
  setToolboxCategory: (cat: string) => void
  setSettingsOpen: (v: boolean) => void
  setSearchOpen: (v: boolean) => void
  setSearchMatches: (m: UIState['searchMatches']) => void
  setSearchActiveIdx: (i: number) => void
  setMergeItems: (items: UIState['mergeItems']) => void
  confirm: (opts: { title: string; message?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }) => Promise<boolean>
  resolveConfirm: (v: boolean) => void
  setDrawColor: (c: string) => void
  setDrawWidth: (w: number) => void
  setDrawOpacity: (o: number) => void
  setShapeType: (t: ShapeType) => void
  setShapeFill: (c: string) => void
  setShapeStroke: (c: string) => void
  setShapeWidth: (w: number) => void
  setHighlightColor: (c: string) => void
  setHighlightOpacity: (o: number) => void
  setStampText: (t: string) => void
  setStampColor: (c: string) => void
  setStampIsHebrew: (v: boolean) => void
  setTextFont: (f: string) => void
  setTextSize: (s: number) => void
  setTextBold: (v: boolean) => void
  setTextItalic: (v: boolean) => void
  setTextUnderline: (v: boolean) => void
  setTextColor: (c: string) => void
  setTextAlign: (a: AlignType) => void
  setTextDirection: (d: 'rtl'|'ltr'|'auto') => void
  setAuthorName: (n: string) => void
  setAutoSaveInterval: (n: number) => void
  setDateFormat: (f: 'gregorian'|'hebrew') => void
}

export const useUIStore = create<UIState>()((set) => ({
  activeTool: 'select',
  sidePanel: 'thumbnails',
  rightPanelOpen: true,
  darkMode: localStorage.getItem('darkMode') === 'true',
  isFullscreen: false,
  isMobileMenuOpen: false,
  showDropOverlay: false,
  toasts: [],
  toolboxOpen: false,
  toolboxCategory: 'organize',
  settingsOpen: false,
  searchOpen: false,
  searchMatches: [],
  searchActiveIdx: 0,
  mergeItems: [],
  confirmDialog: {
    open: false, title: '', message: '', confirmLabel: 'אישור', cancelLabel: 'ביטול',
    danger: false, resolve: null,
  },

  drawColor: '#ef4444',
  drawWidth: 3,
  drawOpacity: 1,
  shapeType: 'rect',
  shapeFill: 'transparent',
  shapeStroke: '#2563eb',
  shapeWidth: 2,
  highlightColor: 'rgba(255,235,59,0.45)',
  highlightOpacity: 0.45,
  stampText: 'אושר',
  stampColor: '#dc2626',
  stampIsHebrew: true,

  textFont: 'Heebo',
  textSize: 16,
  textBold: false,
  textItalic: false,
  textUnderline: false,
  textColor: '#0f172a',
  textAlign: 'right',
  textDirection: 'auto',

  authorName: localStorage.getItem('authorName') || '',
  autoSaveInterval: 30,
  dateFormat: 'gregorian',

  savedSignatures: JSON.parse(localStorage.getItem('savedSignatures') || '[]'),

  setTool: (tool) => {
    if (tool === 'text') ensureAnnotationFonts()
    if (tool === 'redact' && !localStorage.getItem('redactWarned')) {
      localStorage.setItem('redactWarned', '1')
      setTimeout(() => useUIStore.getState().addToast('שים לב: הכיסוי מסתיר ויזואלית בלבד — הטקסט המקורי נשאר בקובץ', 'warning'), 300)
    }
    set({ activeTool: tool })
  },
  setSidePanel: (panel) => set({ sidePanel: panel }),
  toggleSidePanel: (panel) => set((s) => ({ sidePanel: s.sidePanel === panel ? null : panel })),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  toggleDarkMode: () => set((s) => {
    const v = !s.darkMode
    localStorage.setItem('darkMode', String(v))
    document.documentElement.classList.toggle('dark', v)
    // Keep the mobile status bar / PWA chrome in sync with the app theme
    document.querySelectorAll('meta[name="theme-color"]').forEach(m =>
      m.setAttribute('content', v ? '#0f172a' : '#ffffff'))
    return { darkMode: v }
  }),
  setFullscreen: (v) => set({ isFullscreen: v }),
  setMobileMenuOpen: (v) => set({ isMobileMenuOpen: v }),
  setShowDropOverlay: (v) => set({ showDropOverlay: v }),
  addToast: (message, type = 'info') => {
    const id = uuidv4()
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) }))
    }, 3500)
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) })),
  setToolboxOpen: (v) => set({ toolboxOpen: v }),
  setToolboxCategory: (cat) => set({ toolboxCategory: cat }),
  setSettingsOpen: (v) => set({ settingsOpen: v }),
  setSearchOpen: (v) => set(v ? { searchOpen: true } : { searchOpen: false, searchMatches: [], searchActiveIdx: 0 }),
  setSearchMatches: (m) => set({ searchMatches: m, searchActiveIdx: 0 }),
  setSearchActiveIdx: (i) => set({ searchActiveIdx: i }),
  setMergeItems: (items) => set({ mergeItems: items }),
  confirm: (opts) => new Promise<boolean>((resolve) => {
    set({
      confirmDialog: {
        open: true,
        title: opts.title,
        message: opts.message || '',
        confirmLabel: opts.confirmLabel || 'אישור',
        cancelLabel: opts.cancelLabel || 'ביטול',
        danger: opts.danger || false,
        resolve,
      }
    })
  }),
  resolveConfirm: (v) => set((s) => {
    s.confirmDialog.resolve?.(v)
    return { confirmDialog: { ...s.confirmDialog, open: false, resolve: null } }
  }),
  setDrawColor: (c) => set({ drawColor: c }),
  setDrawWidth: (w) => set({ drawWidth: w }),
  setDrawOpacity: (o) => set({ drawOpacity: o }),
  setShapeType: (t) => set({ shapeType: t }),
  setShapeFill: (c) => set({ shapeFill: c }),
  setShapeStroke: (c) => set({ shapeStroke: c }),
  setShapeWidth: (w) => set({ shapeWidth: w }),
  setHighlightColor: (c) => set({ highlightColor: c }),
  setHighlightOpacity: (o) => set({ highlightOpacity: o }),
  setStampText: (t) => set({ stampText: t }),
  setStampColor: (c) => set({ stampColor: c }),
  setStampIsHebrew: (v) => set({ stampIsHebrew: v }),
  setTextFont: (f) => set({ textFont: f }),
  setTextSize: (s) => set({ textSize: s }),
  setTextBold: (v) => set({ textBold: v }),
  setTextItalic: (v) => set({ textItalic: v }),
  setTextUnderline: (v) => set({ textUnderline: v }),
  setTextColor: (c) => set({ textColor: c }),
  setTextAlign: (a) => set({ textAlign: a }),
  setTextDirection: (d) => set({ textDirection: d }),
  setAuthorName: (n) => { localStorage.setItem('authorName', n); set({ authorName: n }) },
  setAutoSaveInterval: (n) => set({ autoSaveInterval: n }),
  setDateFormat: (f) => set({ dateFormat: f }),
  addSavedSignature: (sig) => set((s) => {
    const updated = [...s.savedSignatures, { ...sig, id: Math.random().toString(36).slice(2) }]
    localStorage.setItem('savedSignatures', JSON.stringify(updated))
    return { savedSignatures: updated }
  }),
  removeSavedSignature: (id) => set((s) => {
    const updated = s.savedSignatures.filter(s => s.id !== id)
    localStorage.setItem('savedSignatures', JSON.stringify(updated))
    return { savedSignatures: updated }
  }),
}))

// ────────────────────────────────────────────────
// PDF Store
// ────────────────────────────────────────────────
export interface WatermarkSettings {
  text: string
  fontSize: number
  opacity: number
  /** Drag offset from page center, natural display px */
  dx: number
  dy: number
}

export interface PageNumberSettings {
  position: 'center' | 'right' | 'left'
  startAt: number
  /** Drag offset from the default anchor, natural display px */
  dx: number
  dy: number
}

interface PDFState {
  pdfDoc: any | null
  pdfBytes: Uint8Array | null
  fileName: string
  pageCount: number
  currentPage: number
  zoom: number
  viewMode: ViewMode
  pageOrder: number[]
  pageInfos: PageInfo[]
  /** Optional per-page badge, aligned to natural page index (e.g. "עותק") */
  pageLabels: (string | null)[]
  /** Live document decorations — editable overlays, baked only on export */
  watermark: WatermarkSettings | null
  pageNumbers: PageNumberSettings | null
  isLoading: boolean
  loadingProgress: number
  isSaving: boolean
  hasUnsavedChanges: boolean
  recentFiles: Array<{ name: string; size: number; lastOpened: number; dataUrl?: string }>

  setPdfDoc: (doc: any, bytes: Uint8Array, name: string, pageCount: number) => void
  clearPdf: () => void
  setCurrentPage: (page: number) => void
  setZoom: (zoom: number) => void
  setViewMode: (mode: ViewMode) => void
  setPageOrder: (order: number[]) => void
  setPageLabels: (labels: (string | null)[]) => void
  setWatermark: (w: WatermarkSettings | null) => void
  setPageNumbers: (p: PageNumberSettings | null) => void
  setPageInfo: (index: number, info: Partial<PageInfo>) => void
  setIsLoading: (v: boolean, progress?: number) => void
  setIsSaving: (v: boolean) => void
  setHasUnsavedChanges: (v: boolean) => void
  addRecentFile: (name: string, size: number, dataUrl?: string) => void
  reorderPages: (fromIdx: number, toIdx: number) => void
  rotatePage: (pageIndex: number, degrees: number) => void
}

export const usePDFStore = create<PDFState>()((set, get) => ({
  pdfDoc: null,
  pdfBytes: null,
  fileName: '',
  pageCount: 0,
  currentPage: 0,
  zoom: 1.0,
  viewMode: 'continuous',
  pageOrder: [],
  pageInfos: [],
  pageLabels: [],
  watermark: null,
  pageNumbers: null,
  isLoading: false,
  loadingProgress: 0,
  isSaving: false,
  hasUnsavedChanges: false,
  recentFiles: JSON.parse(localStorage.getItem('recentFiles') || '[]'),

  setPdfDoc: (doc, bytes, name, pageCount) => {
    const order = Array.from({ length: pageCount }, (_, i) => i)
    const infos: PageInfo[] = order.map(i => ({ index: i, width: 595, height: 842, rotation: 0, scale: 1 }))
    set({ pdfDoc: doc, pdfBytes: bytes, fileName: name, pageCount, pageOrder: order, pageInfos: infos, pageLabels: new Array(pageCount).fill(null), currentPage: 0, hasUnsavedChanges: false })
  },
  clearPdf: () => set({ pdfDoc: null, pdfBytes: null, fileName: '', pageCount: 0, currentPage: 0, pageOrder: [], pageInfos: [], pageLabels: [], watermark: null, pageNumbers: null, hasUnsavedChanges: false }),
  setCurrentPage: (page) => set({ currentPage: Math.max(0, Math.min(page, get().pageCount - 1)) }),
  setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(zoom, 5.0)) }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setPageOrder: (order) => set({ pageOrder: order }),
  setPageLabels: (labels) => set({ pageLabels: labels }),
  setWatermark: (w) => set({ watermark: w, hasUnsavedChanges: true }),
  setPageNumbers: (p) => set({ pageNumbers: p, hasUnsavedChanges: true }),
  setPageInfo: (index, info) => set((s) => {
    const infos = [...s.pageInfos]
    if (infos[index]) infos[index] = { ...infos[index], ...info }
    return { pageInfos: infos }
  }),
  setIsLoading: (v, progress = 0) => set({ isLoading: v, loadingProgress: progress }),
  setIsSaving: (v) => set({ isSaving: v }),
  setHasUnsavedChanges: (v) => set({ hasUnsavedChanges: v }),
  addRecentFile: (name, size, dataUrl) => {
    const prev = get().recentFiles
    const updated = [
      { name, size, lastOpened: Date.now(), dataUrl },
      ...prev.filter(f => f.name !== name)
    ].slice(0, MAX_RECENT)
    localStorage.setItem('recentFiles', JSON.stringify(updated.map(f => ({ ...f, dataUrl: undefined }))))
    set({ recentFiles: updated })
  },
  reorderPages: (fromIdx, toIdx) => set((s) => {
    const order = [...s.pageOrder]
    const [moved] = order.splice(fromIdx, 1)
    order.splice(toIdx, 0, moved)
    return { pageOrder: order, hasUnsavedChanges: true }
  }),
  rotatePage: (pageIndex, degrees) => set((s) => {
    const infos = [...s.pageInfos]
    const info = infos[pageIndex]
    if (!info) return s
    const steps = (((degrees / 90) % 4) + 4) % 4
    infos[pageIndex] = {
      ...info,
      rotation: ((info.rotation || 0) + degrees) % 360,
      // Natural display dims swap on quarter turns
      width: steps % 2 === 1 ? info.height : info.width,
      height: steps % 2 === 1 ? info.width : info.height,
    }
    // Rotate this page's annotations so they stay glued to the content.
    // For each 90° CW step in old view dims (w,h): (x,y) → (h - y, x)
    rotatePageAnnotations(pageIndex, steps, info.width, info.height)
    return { pageInfos: infos, hasUnsavedChanges: true }
  }),
}))

/**
 * Rotate all annotations on a page by `steps` quarter-turns clockwise,
 * starting from a view of size (w, h), so they track the rotated content.
 * One CW step maps a display point (x, y) → (h − y, x).
 */
function rotatePageAnnotations(pageIndex: number, steps: number, w: number, h: number) {
  if (steps === 0) return
  const state = useAnnotationsStore.getState()
  const rotPoint = (p: { x: number; y: number }, vh: number) => ({ x: vh - p.y, y: p.x })
  const rotRect = (r: { x: number; y: number; width: number; height: number }, vh: number) => ({
    x: vh - r.y - r.height, y: r.x, width: r.height, height: r.width,
  })

  const updated = state.annotations.map(a => {
    if (a.pageIndex !== pageIndex) return a
    let vw = w, vh = h
    let ann: any = { ...a }
    for (let s = 0; s < steps; s++) {
      if ('rect' in ann && ann.rect) ann = { ...ann, rect: rotRect(ann.rect, vh) }
      if ('points' in ann && ann.points) ann = { ...ann, points: ann.points.map((p: any) => rotPoint(p, vh)) }
      if ('position' in ann && ann.position) ann = { ...ann, position: rotPoint(ann.position, vh) }
      ;[vw, vh] = [vh, vw]
    }
    return ann
  })
  useAnnotationsStore.setState({ annotations: updated })
}

// ────────────────────────────────────────────────
// Annotations Store
// ────────────────────────────────────────────────
interface AnnotationsState {
  annotations: Annotation[]
  selectedId: string | null
  past: HistoryEntry[]
  future: HistoryEntry[]
  formFields: FormField[]

  addAnnotation: (ann: Omit<Annotation, 'id' | 'createdAt'>) => string
  updateAnnotation: (id: string, changes: Partial<Annotation>) => void
  deleteAnnotation: (id: string) => void
  deleteAllOnPage: (pageIndex: number) => void
  selectAnnotation: (id: string | null) => void
  undo: () => void
  redo: () => void
  pushHistory: () => void
  clearHistory: () => void
  getPageAnnotations: (pageIndex: number) => Annotation[]

  addFormField: (field: Omit<FormField, 'id'>) => string
  updateFormField: (id: string, changes: Partial<FormField>) => void
  deleteFormField: (id: string) => void
  getPageFormFields: (pageIndex: number) => FormField[]
  clearFormData: () => void
  importFormFields: (fields: FormField[]) => void

  loadFromStorage: (fileName: string) => void
  saveToStorage: (fileName: string) => void
}

export const useAnnotationsStore = create<AnnotationsState>()(subscribeWithSelector((set, get) => ({
  annotations: [],
  selectedId: null,
  past: [],
  future: [],
  formFields: [],

  addAnnotation: (ann) => {
    const id = uuidv4()
    const full = { ...ann, id, createdAt: Date.now() } as Annotation
    set((s) => ({ annotations: [...s.annotations, full], future: [] }))
    usePDFStore.getState().setHasUnsavedChanges(true)
    return id
  },
  updateAnnotation: (id, changes) => {
    set((s) => ({
      annotations: s.annotations.map(a => a.id === id ? { ...a, ...changes } as Annotation : a),
      future: []
    }))
    usePDFStore.getState().setHasUnsavedChanges(true)
  },
  deleteAnnotation: (id) => {
    set((s) => ({ annotations: s.annotations.filter(a => a.id !== id), selectedId: s.selectedId === id ? null : s.selectedId }))
    usePDFStore.getState().setHasUnsavedChanges(true)
  },
  deleteAllOnPage: (pageIndex) => {
    set((s) => ({ annotations: s.annotations.filter(a => a.pageIndex !== pageIndex) }))
    usePDFStore.getState().setHasUnsavedChanges(true)
  },
  selectAnnotation: (id) => set({ selectedId: id }),

  pushHistory: () => set((s) => ({
    past: [...s.past.slice(-MAX_HISTORY), { annotations: s.annotations, formFields: s.formFields }],
    future: []
  })),
  undo: () => set((s) => {
    if (!s.past.length) return s
    const prev = s.past[s.past.length - 1]
    return {
      past: s.past.slice(0, -1),
      future: [{ annotations: s.annotations, formFields: s.formFields }, ...s.future],
      annotations: prev.annotations,
      formFields: prev.formFields
    }
  }),
  redo: () => set((s) => {
    if (!s.future.length) return s
    const next = s.future[0]
    return {
      past: [...s.past, { annotations: s.annotations, formFields: s.formFields }],
      future: s.future.slice(1),
      annotations: next.annotations,
      formFields: next.formFields
    }
  }),
  clearHistory: () => set({ past: [], future: [] }),
  getPageAnnotations: (pageIndex) => get().annotations.filter(a => a.pageIndex === pageIndex),

  addFormField: (field) => {
    const id = uuidv4()
    set((s) => ({ formFields: [...s.formFields, { ...field, id }] }))
    return id
  },
  updateFormField: (id, changes) => {
    set((s) => ({ formFields: s.formFields.map(f => f.id === id ? { ...f, ...changes } : f) }))
  },
  deleteFormField: (id) => {
    set((s) => ({ formFields: s.formFields.filter(f => f.id !== id) }))
  },
  getPageFormFields: (pageIndex) => get().formFields.filter(f => f.pageIndex === pageIndex),
  clearFormData: () => {
    set((s) => ({ formFields: s.formFields.map(f => ({ ...f, value: f.type === 'checkbox' ? false : '' })) }))
  },
  importFormFields: (fields) => set({ formFields: fields }),

  loadFromStorage: (fileName) => {
    try {
      const key = `pdf_annotations_${fileName}`
      const data = localStorage.getItem(key)
      if (data) {
        const parsed = JSON.parse(data)
        set({ annotations: parsed.annotations || [], formFields: parsed.formFields || [] })
      } else {
        set({ annotations: [], formFields: [] })
      }
    } catch { set({ annotations: [], formFields: [] }) }
  },
  saveToStorage: (fileName) => {
    const { annotations, formFields } = get()
    const key = `pdf_annotations_${fileName}`
    localStorage.setItem(key, JSON.stringify({ annotations, formFields, savedAt: Date.now() }))
  }
})))
