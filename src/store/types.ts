export type ToolType =
  | 'select' | 'text' | 'highlight' | 'underline' | 'strikethrough'
  | 'draw' | 'eraser' | 'shapes' | 'stamp' | 'redact'
  | 'signature' | 'comment' | 'toolbox'

export type ShapeType = 'rect' | 'ellipse' | 'line' | 'arrow'
export type ViewMode = 'continuous' | 'two-page'
export type HighlightColor = 'yellow' | 'green' | 'pink' | 'blue'
export type AlignType = 'left' | 'center' | 'right' | 'justify'
export type ExportFormat = 'pdf' | 'flattened' | 'pdfa'
export type SidePanel = 'thumbnails' | 'annotations' | null

export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; width: number; height: number }

export interface BaseAnnotation {
  id: string
  pageIndex: number
  type: string
  createdAt: number
  author?: string
}

export interface HighlightAnnotation extends BaseAnnotation {
  type: 'highlight' | 'underline' | 'strikethrough'
  rect: Rect
  color: string
  opacity: number
}

export interface DrawAnnotation extends BaseAnnotation {
  type: 'draw'
  points: Point[]
  color: string
  strokeWidth: number
  opacity: number
}

export interface ShapeAnnotation extends BaseAnnotation {
  type: 'shape'
  shape: ShapeType
  rect: Rect
  strokeColor: string
  fillColor: string
  strokeWidth: number
  opacity: number
}

export interface TextBoxAnnotation extends BaseAnnotation {
  type: 'textbox'
  rect: Rect
  content: string
  fontFamily: string
  fontSize: number
  fontWeight: string
  fontStyle: string
  textDecoration: string
  color: string
  align: AlignType
  direction: 'rtl' | 'ltr' | 'auto'
}

export interface StickyAnnotation extends BaseAnnotation {
  type: 'sticky'
  position: Point
  content: string
  color: string
  author: string
  isOpen: boolean
}

export interface StampAnnotation extends BaseAnnotation {
  type: 'stamp'
  rect: Rect
  text: string
  isHebrew: boolean
  color: string
  fontSize: number
  rotation: number
}

export interface SignatureAnnotation extends BaseAnnotation {
  type: 'signature'
  rect: Rect
  imageData: string
  rotation: number
}

export interface FormField {
  id: string
  pageIndex: number
  type: 'text' | 'checkbox' | 'radio' | 'dropdown' | 'date'
  rect: Rect
  name: string
  value: string | boolean
  options?: string[]
  required: boolean
  placeholder: string
  pdfFieldRef?: string
}

export type Annotation =
  | HighlightAnnotation | DrawAnnotation | ShapeAnnotation
  | TextBoxAnnotation | StickyAnnotation | StampAnnotation | SignatureAnnotation

export interface PageInfo {
  index: number
  width: number
  height: number
  rotation: number
  scale: number
}

export interface HistoryEntry {
  annotations: Annotation[]
  formFields: FormField[]
}
