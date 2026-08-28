import React, { useEffect, useMemo, useRef, useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import { usePDFStore, useUIStore } from '../../../store'
import { usePDF } from '../../../hooks/usePDF'
import { useEditedBytes } from '../../../hooks/usePageOps'
import { useGridReorder, moveItem, moveMany } from '../../../hooks/useGridReorder'
import { downloadBlob } from '../../../utils/pdfExport'
import { askFileName } from '../../ui/PromptDialog'
import { InfoBar, FilePicker, PrimaryButton, GhostButton, Spinner, SegmentedControl, parseRanges } from '../toolsShared'

const EASE = 'cubic-bezier(0.23,1,0.32,1)'

type MergeItem = { id: string; kind: 'current' } | { id: string; kind: 'file'; file: File }

/** Where an added file's pages land, mirroring what desktop editors offer. */
type InsertMode = 'start' | 'before' | 'after' | 'end'

/** "<itemId>:<pageIndex>" — ids can contain ':', so split from the right. */
const pageKey = (itemId: string, page: number) => `${itemId}:${page}`
const splitKey = (key: string) => {
  const i = key.lastIndexOf(':')
  return { itemId: key.slice(0, i), page: parseInt(key.slice(i + 1)) }
}

/**
 * Merge tool: add any number of PDFs, then arrange the result page by page.
 * Every page of every source appears as a draggable card, so pages can be
 * interleaved across files — not just whole files reordered.
 */
export const MergePanel: React.FC = () => {
  const { pdfDoc, fileName } = usePDFStore()
  const { addToast, mergeItems, setMergeItems, mergePageOrder, setMergePageOrder } = useUIStore()
  const { loadPDF } = usePDF()
  const [busy, setBusy] = useState(false)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loadingSources, setLoadingSources] = useState(false)
  const jsDocs = useRef<Map<string, any>>(new Map())
  const getEdited = useEditedBytes()

  // Where the next file's pages go. Appending was the only option, which
  // meant dragging them up one at a time through a long document.
  const [insertMode, setInsertMode] = useState<InsertMode>('end')
  const [insertAnchor, setInsertAnchor] = useState('1')
  /** Which pages of the added file to take, e.g. "1-3, 8". Empty = all. */
  const [sourceRange, setSourceRange] = useState('')
  /** Consumed once by the reconcile effect below. */
  const pendingInsertAt = useRef<number | null>(null)
  /** Per-file page range, kept so the choice survives a re-render. */
  const [ranges, setRanges] = useState<Record<string, string>>({})
  /** Pages the user took out. Without this they came back on the next add. */
  const [excluded, setExcluded] = useState<Set<string>>(new Set())

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const lastClicked = useRef<number | null>(null)

  // Seed the open document as the first source; drop it if it was closed
  useEffect(() => {
    const items = useUIStore.getState().mergeItems
    if (!pdfDoc) {
      const cleaned = items.filter(i => i.kind !== 'current')
      if (cleaned.length !== items.length) setMergeItems(cleaned)
    } else if (items.length === 0) {
      setMergeItems([{ id: 'current', kind: 'current' }])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc])

  const items: MergeItem[] = pdfDoc ? mergeItems : mergeItems.filter(i => i.kind !== 'current')

  // Load each source once so its pages can be counted and previewed
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const missing = items.filter(it => !jsDocs.current.has(it.id))
      if (!missing.length) return
      setLoadingSources(true)
      for (const item of missing) {
        try {
          const doc = item.kind === 'current'
            ? pdfDoc
            : await pdfjsLib.getDocument({ data: new Uint8Array(await item.file.arrayBuffer()) }).promise
          if (cancelled) return
          jsDocs.current.set(item.id, doc)
          setCounts(c => ({ ...c, [item.id]: doc?.numPages || 0 }))
        } catch (e) {
          console.error('merge source failed to load', e)
          addToast('אחד הקבצים לא נטען', 'error')
        }
      }
      if (!cancelled) setLoadingSources(false)
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map(i => i.id).join('|'), pdfDoc])

  // Every page currently available, in file order
  const availableKeys = useMemo(
    () => items.flatMap(it => Array.from({ length: counts[it.id] || 0 }, (_, p) => pageKey(it.id, p))),
    [items, counts])

  // Keep the user's arrangement, drop removed pages, and place newly added
  // ones where they were asked to go
  useEffect(() => {
    const available = new Set(availableKeys)
    const kept = mergePageOrder.filter(k => available.has(k))
    const keptSet = new Set(kept)
    const fresh = availableKeys.filter(k => !keptSet.has(k))

    // A page the user removed must not reappear when the next file is added,
    // and a file added with a page range only contributes those pages
    const allowedByRange = (key: string) => {
      const { itemId, page } = splitKey(key)
      const spec = ranges[itemId]
      if (!spec?.trim()) return true
      return parseRanges(spec, counts[itemId] || 0).includes(page + 1)
    }
    const incoming = fresh.filter(k => !excluded.has(k) && allowedByRange(k))

    const at = pendingInsertAt.current
    pendingInsertAt.current = null
    const where = at === null ? kept.length : Math.max(0, Math.min(kept.length, at))
    const next = [...kept.slice(0, where), ...incoming, ...kept.slice(where)]

    if (next.length !== mergePageOrder.length || next.some((k, i) => k !== mergePageOrder[i])) {
      setMergePageOrder(next)
      // Hand the new pages over already selected, so they can be nudged as a
      // group — but only when they joined an existing document. On the first
      // file there is nothing to move them relative to, and starting with
      // everything selected is just something to undo.
      if (incoming.length && kept.length) setSelected(new Set(incoming))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableKeys.join('|')])

  const reorder = useGridReorder((from, to) => {
    const order = useUIStore.getState().mergePageOrder
    const dragged = order[from]
    // Dragging one of several selected pages moves the whole group
    if (selected.size > 1 && selected.has(dragged)) {
      setMergePageOrder(moveMany(order, selected, to))
    } else {
      setMergePageOrder(moveItem(order, from, to))
    }
  })

  const addFiles = (fs: File[]) => {
    const added = fs.map(f => ({
      id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 7)}`,
      kind: 'file' as const,
      file: f,
    }))
    const anchor = parseInt(insertAnchor) || 1
    const total = mergePageOrder.length
    pendingInsertAt.current =
      insertMode === 'end' ? total
      : insertMode === 'start' ? 0
      : insertMode === 'before' ? anchor - 1
      : anchor // after
    if (sourceRange.trim()) {
      setRanges(prev => {
        const next = { ...prev }
        added.forEach(a => { next[a.id] = sourceRange })
        return next
      })
    }
    setMergeItems([...items, ...added])
  }

  const removeSource = (id: string) => {
    jsDocs.current.delete(id)
    setCounts(c => { const n = { ...c }; delete n[id]; return n })
    setMergeItems(items.filter(i => i.id !== id))
  }

  const removePage = (key: string) => {
    setMergePageOrder(mergePageOrder.filter(k => k !== key))
    setExcluded(prev => new Set(prev).add(key))
    setSelected(prev => { const n = new Set(prev); n.delete(key); return n })
  }

  // ── Selection ─────────────────────────────────────────────────────────────
  /** Click toggles; Shift extends from the last click, as in any file list. */
  const toggleSelection = (index: number, shiftKey: boolean) => {
    const key = mergePageOrder[index]
    setSelected(prev => {
      const next = new Set(prev)
      if (shiftKey && lastClicked.current !== null) {
        const [a, b] = [lastClicked.current, index].sort((x, y) => x - y)
        for (let i = a; i <= b; i++) next.add(mergePageOrder[i])
      } else if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
    lastClicked.current = index
  }

  const selectAll = () => setSelected(new Set(mergePageOrder))
  const clearSelection = () => { setSelected(new Set()); lastClicked.current = null }

  const removeSelected = () => {
    setMergePageOrder(mergePageOrder.filter(k => !selected.has(k)))
    setExcluded(prev => new Set([...prev, ...selected]))
    clearSelection()
  }

  const moveSelected = (to: 'start' | 'end') => {
    setMergePageOrder(moveMany(mergePageOrder, selected, to === 'start' ? 0 : mergePageOrder.length))
  }

  const sourceLabel = (id: string) => {
    const item = items.find(i => i.id === id)
    if (!item) return ''
    return item.kind === 'current' ? fileName : item.file.name
  }

  /** Build the merged document in the exact page order shown. */
  const buildMerged = async (): Promise<Uint8Array> => {
    const out = await PDFDocument.create()
    const libDocs = new Map<string, PDFDocument>()

    for (const key of mergePageOrder) {
      const { itemId, page } = splitKey(key)
      if (!libDocs.has(itemId)) {
        const item = items.find(i => i.id === itemId)
        if (!item) continue
        const bytes = item.kind === 'current'
          ? await getEdited({ withDecorations: true })
          : new Uint8Array(await item.file.arrayBuffer())
        libDocs.set(itemId, await PDFDocument.load(bytes, { ignoreEncryption: true }))
      }
      const src = libDocs.get(itemId)!
      if (page >= src.getPageCount()) continue
      const [copied] = await out.copyPages(src, [page])
      out.addPage(copied)
    }
    return out.save()
  }

  const suggestedName = () => {
    const first = items[0]
    const base = first?.kind === 'current' ? fileName
      : first?.kind === 'file' ? first.file.name : 'merged'
    return base.replace(/\.pdf$/i, '') + '-ממוזג.pdf'
  }

  const mergeAndDownload = async () => {
    const outName = await askFileName(suggestedName(), '.pdf')
    if (!outName) return
    setBusy(true)
    try {
      downloadBlob(await buildMerged(), outName)
      addToast('הקובץ הממוזג ירד בהצלחה', 'success')
    } catch (e) { console.error(e); addToast('שגיאה במיזוג', 'error') } finally { setBusy(false) }
  }

  const mergeAndOpen = async () => {
    setBusy(true)
    try {
      const bytes = await buildMerged()
      await loadPDF(bytes.buffer as ArrayBuffer, { name: suggestedName() })
      setMergeItems([]); setMergePageOrder([]); jsDocs.current.clear(); setCounts({})
      addToast('הקובץ הממוזג נפתח בעורך', 'success')
      window.location.hash = '#/editor'
    } catch (e) { console.error(e); addToast('שגיאה במיזוג', 'error') } finally { setBusy(false) }
  }

  const totalPages = mergePageOrder.length
  const canMerge = items.length >= 1 && totalPages >= 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <InfoBar text="הוסף קבצים, ואז גרור עמודים לסידור המדויק של הקובץ הממוזג — אפשר גם לשלב עמודים מקבצים שונים." />
      <FilePicker accept=".pdf" multiple label="הוסף קבצי PDF" onPick={addFiles} />

      {/* Where the next file lands, and how much of it to take */}
      <div style={{
        border: '1px solid var(--color-border)', borderRadius: 12,
        padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <SegmentedControl
          label="מיקום הקובץ הבא"
          value={insertMode}
          options={[
            { value: 'start', label: 'בהתחלה' },
            { value: 'before', label: 'לפני עמוד' },
            { value: 'after', label: 'אחרי עמוד' },
            { value: 'end', label: 'בסוף' },
          ]}
          onChange={v => setInsertMode(v as InsertMode)}
        />

        {(insertMode === 'before' || insertMode === 'after') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label className="label" htmlFor="merge-insert-anchor" style={{ margin: 0, flexShrink: 0 }}>
              {insertMode === 'before' ? 'לפני עמוד' : 'אחרי עמוד'}
            </label>
            <input
              id="merge-insert-anchor"
              className="input"
              value={insertAnchor}
              inputMode="numeric"
              dir="ltr"
              onChange={e => setInsertAnchor(e.target.value.replace(/\D/g, '').slice(0, 4))}
              style={{ width: 80, textAlign: 'center' }}
            />
            <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
              מתוך {mergePageOrder.length || 0}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label className="label" htmlFor="merge-source-range" style={{ margin: 0, flexShrink: 0 }}>
            עמודים מהקובץ
          </label>
          <input
            id="merge-source-range"
            className="input"
            value={sourceRange}
            dir="ltr"
            placeholder="הכל"
            onChange={e => setSourceRange(e.target.value)}
            style={{ flex: 1, minWidth: 0, textAlign: 'center' }}
          />
          <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>1-3, 8</span>
        </div>
      </div>

      {/* Sources */}
      {items.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {items.map(item => (
            <span key={item.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 8px 5px 4px', borderRadius: 20, fontSize: 11.5, fontWeight: 600,
              background: item.kind === 'current' ? 'var(--color-mint)' : 'var(--color-surface-2)',
              color: 'var(--color-text)', maxWidth: '100%',
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>
                {item.kind === 'current' ? `${fileName} (פתוח)` : item.file.name}
              </span>
              <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>
                {counts[item.id] ?? '…'}
              </span>
              <button
                aria-label={`הסר את ${item.kind === 'current' ? fileName : item.file.name}`}
                onClick={() => removeSource(item.id)}
                style={{
                  width: 20, height: 20, borderRadius: '50%', border: 'none', flexShrink: 0,
                  background: 'rgba(239,68,68,0.16)', color: '#ef4444', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  minHeight: 0, padding: 0,
                }}
              >
                <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {loadingSources && (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
          <Spinner /> טוען עמודים…
        </div>
      )}

      {/* Page arrangement */}
      {totalPages > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)', flex: 1, minWidth: 120 }}>
              {selected.size
                ? `נבחרו ${selected.size} עמודים · גרור אחד מהם כדי להזיז את כולם`
                : `${totalPages} עמודים · הקש על עמוד לבחירה, גרור מהידית לשינוי הסדר`}
            </span>
            <button onClick={selected.size ? clearSelection : selectAll} style={chipStyle()}>
              {selected.size ? 'נקה בחירה' : 'בחר הכל'}
            </button>
          </div>

          {selected.size > 0 && (
            <div data-merge-selection-bar style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => moveSelected('start')} style={chipStyle()}>⤒ להתחלה</button>
              <button onClick={() => moveSelected('end')} style={chipStyle()}>⤓ לסוף</button>
              <button onClick={removeSelected} style={chipStyle(true)}>הסר {selected.size} עמודים</button>
            </div>
          )}
          <div
            ref={reorder.gridRef}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))', gap: 8 }}
          >
            {mergePageOrder.map((key, i) => {
              const { itemId, page } = splitKey(key)
              const doc = jsDocs.current.get(itemId)
              const isDragging = reorder.dragIdx === i
              const shift = reorder.shiftFor(i)
              const isSelected = selected.has(key)
              // While a group is being dragged, its other members stay put but
              // read as "coming along"
              const ridingAlong = isSelected && reorder.dragIdx !== null && !isDragging
                && selected.size > 1 && selected.has(mergePageOrder[reorder.dragIdx])
              return (
                <div
                  key={key}
                  data-grid-cell
                  data-merge-page
                  data-selected={isSelected ? 'true' : undefined}
                  onClick={e => {
                    // Buttons and the drag handle keep their own behaviour
                    if ((e.target as HTMLElement).closest('button,[data-drag-handle]')) return
                    toggleSelection(i, e.shiftKey)
                  }}
                  style={{
                    position: 'relative', borderRadius: 12, padding: 5, cursor: 'pointer',
                    background: isSelected ? 'rgba(37,99,235,0.12)' : 'var(--color-surface-2)',
                    opacity: ridingAlong ? 0.55 : 1,
                    outline: isDragging ? '2px solid var(--color-accent)'
                      : isSelected ? '2px solid var(--color-accent)'
                      : reorder.targetIdx === i && reorder.dragIdx !== null ? '2px dashed var(--color-accent)' : 'none',
                    transform: isDragging
                      ? `translate(${reorder.delta.x}px, ${reorder.delta.y}px) scale(1.05)`
                      : `translate(${shift.x}px, ${shift.y}px)`,
                    transition: isDragging ? 'none' : `transform 200ms ${EASE}`,
                    zIndex: isDragging ? 20 : 1,
                    boxShadow: isDragging ? '0 12px 30px rgba(0,0,0,0.25)' : 'none',
                  }}
                >
                  <div style={{
                    width: '100%', aspectRatio: '1 / 1.414', background: 'white',
                    borderRadius: 7, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.14)',
                  }}>
                    {doc && <MergeThumb doc={doc} pageIndex={page} />}
                  </div>

                  <div
                    data-drag-handle
                    onPointerDown={e => reorder.start(e, i)}
                    aria-label="גרור לשינוי סדר"
                    title="גרור לשינוי סדר"
                    style={{
                      position: 'absolute', top: 9, insetInlineStart: 9,
                      width: 26, height: 26, borderRadius: 7,
                      background: 'rgba(20,20,20,0.62)', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'grab', touchAction: 'none', backdropFilter: 'blur(3px)',
                    }}
                  >
                    <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/>
                      <circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/>
                      <circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/>
                    </svg>
                  </div>

                  <button
                    aria-label="הסר עמוד"
                    title="הסר עמוד מהמיזוג"
                    onClick={() => removePage(key)}
                    style={{
                      position: 'absolute', top: 9, insetInlineEnd: 9,
                      width: 26, height: 26, borderRadius: 7, border: 'none',
                      background: 'rgba(20,20,20,0.62)', color: 'white', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      minHeight: 0, padding: 0, backdropFilter: 'blur(3px)',
                    }}
                  >
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.6" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>

                  <div style={{ padding: '6px 3px 1px', display: 'flex', alignItems: 'baseline', gap: 5 }}>
                    <span
                      aria-hidden
                      style={{
                        width: 14, height: 14, borderRadius: 4, flexShrink: 0, alignSelf: 'center',
                        border: `1.5px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                        background: isSelected ? 'var(--color-accent)' : 'transparent',
                        color: 'var(--color-on-accent)', fontSize: 10, lineHeight: '11px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {isSelected ? '✓' : ''}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>{i + 1}</span>
                    <span style={{
                      fontSize: 9.5, color: 'var(--color-text-muted)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {sourceLabel(itemId)} · {page + 1}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {items.length < 1 && (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
          הוסף קבצים כדי להתחיל
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <PrimaryButton onClick={mergeAndDownload} disabled={busy || !canMerge}>
          {busy ? <><Spinner /> ממזג…</> : `מזג ${totalPages || ''} עמודים והורד`}
        </PrimaryButton>
        <GhostButton onClick={mergeAndOpen} disabled={busy || !canMerge}>
          פתח בעורך
        </GhostButton>
      </div>
    </div>
  )
}

/** Small pill button used by the selection toolbar. */
function chipStyle(danger = false): React.CSSProperties {
  return {
    padding: '5px 11px', borderRadius: 20, cursor: 'pointer', minHeight: 0,
    border: `1px solid ${danger ? 'rgba(239,68,68,0.35)' : 'var(--color-border)'}`,
    background: danger ? 'rgba(239,68,68,0.10)' : 'var(--color-surface-2)',
    color: danger ? '#dc2626' : 'var(--color-text)',
    fontSize: 11.5, fontWeight: 600, fontFamily: 'inherit', flexShrink: 0,
  }
}

/** Lazily rendered page thumbnail for a merge source. */
const MergeThumb: React.FC<{ doc: any; pageIndex: number }> = ({ doc, pageIndex }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { renderThumbnail } = usePDF()
  const done = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !done.current) {
          done.current = true
          renderThumbnail(doc, pageIndex, canvas, 200)
        }
      })
    }, { rootMargin: '300px' })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [doc, pageIndex, renderThumbnail])

  return <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }} />
}
