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
  watermark?: unknown
  pageNumbers?: unknown
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

/** Keep saved work bounded — every session holds the full PDF bytes. */
const MAX_SESSIONS = 12
const MAX_TOTAL_BYTES = 250 * 1024 * 1024

export class StorageFullError extends Error {
  constructor() { super('storage full'); this.name = 'StorageFullError' }
}

/**
 * Drop the oldest sessions until both the count and the total byte budget
 * fit, never touching `keepId` (the document being worked on right now).
 * Returns the names that were removed so the UI can say what happened.
 */
async function pruneSessions(keepId: string): Promise<string[]> {
  const metas = await listSessions() // newest first
  const removed: string[] = []
  let total = metas.reduce((n, m) => n + (m.fileSize || 0), 0)

  for (let i = metas.length - 1; i >= 0; i--) {
    const m = metas[i]
    const overCount = metas.length - removed.length > MAX_SESSIONS
    const overBytes = total > MAX_TOTAL_BYTES
    if (!overCount && !overBytes) break
    if (m.id === keepId) continue
    await deleteSession(m.id)
    removed.push(m.name)
    total -= m.fileSize || 0
  }
  return removed
}

/**
 * Persist a session. Prunes old work first so the quota isn't hit, and
 * retries once after an emergency prune if the browser still refuses —
 * a silent write failure used to mean the user simply lost their work.
 */
export async function saveSession(session: PdfSession): Promise<{ pruned: string[] }> {
  let pruned: string[] = []
  try {
    pruned = await pruneSessions(session.id)
  } catch (e) {
    console.warn('pruneSessions failed', e)
  }

  try {
    await tx('readwrite', store => store.put(session))
    return { pruned }
  } catch (e: any) {
    const quota = e?.name === 'QuotaExceededError' ||
      /quota|storage/i.test(String(e?.message || e))
    if (!quota) {
      console.error('saveSession failed', e)
      throw e
    }
    // Emergency: drop everything except the current document, then retry once
    console.warn('storage quota hit — clearing older sessions')
    try {
      const metas = await listSessions()
      for (const m of metas) {
        if (m.id !== session.id) { await deleteSession(m.id); pruned.push(m.name) }
      }
      await tx('readwrite', store => store.put(session))
      return { pruned }
    } catch (retryErr) {
      console.error('saveSession failed after prune', retryErr)
      throw new StorageFullError()
    }
  }
}

export async function getSession(id: string): Promise<PdfSession | undefined> {
  try {
    return await tx('readonly', store => store.get(id))
  } catch (e) {
    console.warn('getSession failed', e)
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
  } catch (e) {
    console.warn('listSessions failed', e)
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
