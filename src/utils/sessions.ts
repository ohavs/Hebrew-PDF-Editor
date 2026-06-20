// ─────────────────────────────────────────────────────────────
// Session persistence via IndexedDB
// Stores the full PDF bytes + annotations + metadata so a user can
// resume working exactly where they left off, even after closing the tab.
// ─────────────────────────────────────────────────────────────
import type { Annotation, FormField, PageInfo } from '../store/types'

const DB_NAME = 'hebrew-pdf-editor'
const STORE = 'sessions'
const DB_VERSION = 1

export interface PdfSession {
  id: string
  name: string
  pdfBytes: ArrayBuffer
  annotations: Annotation[]
  formFields: FormField[]
  pageOrder: number[]
  pageInfos: PageInfo[]
  pageCount: number
  currentPage: number
  zoom: number
  thumbnail: string // dataURL
  fileSize: number
  createdAt: number
  updatedAt: number
}

export type SessionMeta = Omit<PdfSession, 'pdfBytes' | 'annotations' | 'formFields' | 'pageInfos' | 'pageOrder'>

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'id' })
        os.createIndex('updatedAt', 'updatedAt')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(db => new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode)
    const store = transaction.objectStore(STORE)
    const req = fn(store)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }))
}

/** Generate a stable session id from a file name. */
export function sessionIdForName(name: string): string {
  return 'sess_' + name.replace(/[^a-zA-Z0-9֐-׿]/g, '_').slice(0, 60)
}

export async function saveSession(session: PdfSession): Promise<void> {
  try {
    await tx('readwrite', store => store.put(session))
  } catch (e) {
    console.warn('saveSession failed', e)
  }
}

export async function getSession(id: string): Promise<PdfSession | undefined> {
  try {
    return await tx('readonly', store => store.get(id))
  } catch {
    return undefined
  }
}

export async function deleteSession(id: string): Promise<void> {
  try {
    await tx('readwrite', store => store.delete(id))
  } catch (e) {
    console.warn('deleteSession failed', e)
  }
}

/** List sessions (metadata only — strips heavy fields for the list UI). */
export async function listSessions(): Promise<SessionMeta[]> {
  try {
    const all = await tx<PdfSession[]>('readonly', store => store.getAll() as unknown as IDBRequest<PdfSession[]>)
    return all
      .map(({ pdfBytes, annotations, formFields, pageInfos, pageOrder, ...meta }) => meta)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  } catch {
    return []
  }
}

export async function clearAllSessions(): Promise<void> {
  try {
    await tx('readwrite', store => store.clear())
  } catch (e) {
    console.warn('clearAllSessions failed', e)
  }
}
