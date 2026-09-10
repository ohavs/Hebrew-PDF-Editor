/**
 * Pulling a FlipHTML5 publication down as page images.
 *
 * A flipbook is not a document — it is a web page that shows one JPEG per
 * page. Given the address, the pages can be collected and bound into a PDF,
 * which is the whole of what the conversion sites do, minus the watermark they
 * stamp on the result.
 *
 * The catch is the same-origin policy. A browser will only hand a script the
 * bytes of another site's image if that site says so, and no promise can be
 * made here about whether it does — there is no server in this app to fetch on
 * the page's behalf. So the attempt is made honestly and, when the browser
 * refuses, said plainly rather than reported as a broken conversion.
 */

export interface FlipbookSource {
  /** Everything up to and including the trailing slash. */
  base: string
  /** The account and publication the address names. */
  uid: string
  bookId: string
}

/**
 * The publication an address points at.
 *
 * FlipHTML5 addresses come in a few shapes — the marketing host, the reader
 * host, with or without an index page — and all of them carry the same two
 * identifiers.
 */
export function parseFlipbookUrl(input: string): FlipbookSource | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (!/(^|\.)fliphtml5\.com$/i.test(url.hostname)) return null

  const parts = url.pathname.split('/').filter(Boolean)
  // /<uid>/<bookId>[/index.html]
  const cleaned = parts.filter(p => !/\.(html?|php)$/i.test(p))
  if (cleaned.length < 2) return null
  const [uid, bookId] = cleaned.slice(-2)
  if (!uid || !bookId) return null

  return { uid, bookId, base: `https://online.fliphtml5.com/${uid}/${bookId}/` }
}

/** Thrown when the browser refused the request rather than the server. */
export class BlockedByBrowser extends Error {
  constructor() {
    super('blocked-by-browser')
    this.name = 'BlockedByBrowser'
  }
}

const fetchBytes = async (url: string, signal?: AbortSignal): Promise<Uint8Array | null> => {
  let res: Response
  try {
    res = await fetch(url, { signal, mode: 'cors', credentials: 'omit' })
  } catch (e) {
    if ((e as any)?.name === 'AbortError') throw e
    // fetch rejects without a status when the same-origin policy stops it;
    // a genuine 404 resolves normally and is handled below
    throw new BlockedByBrowser()
  }
  if (!res.ok) return null
  const buf = await res.arrayBuffer()
  return buf.byteLength ? new Uint8Array(buf) : null
}

/**
 * How many pages the publication has, according to its own configuration.
 *
 * The reader loads a small script describing the book. It is not JSON and its
 * shape is not promised, so the count is read with a forgiving pattern and a
 * failure here only means falling back to probing.
 */
async function pageCountFromConfig(base: string, signal?: AbortSignal): Promise<number | null> {
  for (const path of ['javascript/config.js', 'mobile/javascript/config.js']) {
    const bytes = await fetchBytes(base + path, signal).catch(e => {
      if (e instanceof BlockedByBrowser) throw e
      return null
    })
    if (!bytes) continue
    const text = new TextDecoder().decode(bytes)
    const direct = /["']?(?:totalPageCount|TotalPageCount|PageCount)["']?\s*[:=]\s*["']?(\d+)/.exec(text)
    if (direct) {
      const n = Number(direct[1])
      if (n > 0 && n < 5000) return n
    }
    // Otherwise count the page entries the configuration lists
    const entries = text.match(/"n"\s*:\s*\[/g)
    if (entries?.length) return entries.length
  }
  return null
}

/** The image folders FlipHTML5 publishes, best quality first. */
const QUALITIES = ['files/large', 'files/mobile', 'files/thumb']

export interface FetchProgress {
  (done: number, total: number | null): void
}

export interface FlipbookPage {
  bytes: Uint8Array
  /** Lower-case extension, for choosing how to embed it. */
  kind: 'jpg' | 'png'
}

/**
 * Every page of the publication, in order.
 *
 * The page count comes from the book's own configuration when it can be read;
 * otherwise pages are requested one after another until one is missing, which
 * needs no configuration at all.
 */
export async function fetchFlipbookPages(
  src: FlipbookSource,
  onProgress: FetchProgress,
  signal?: AbortSignal,
  limit = 400,
): Promise<FlipbookPage[]> {
  const declared = await pageCountFromConfig(src.base, signal)

  // Settle on the best folder that actually answers, using page one as the probe
  let folder: string | null = null
  let firstPage: FlipbookPage | null = null
  for (const quality of QUALITIES) {
    for (const ext of ['jpg', 'png'] as const) {
      const bytes = await fetchBytes(`${src.base}${quality}/1.${ext}`, signal)
      if (bytes) { folder = `${quality}`; firstPage = { bytes, kind: ext }; break }
    }
    if (folder) break
  }
  if (!folder || !firstPage) return []

  const pages: FlipbookPage[] = [firstPage]
  onProgress(1, declared)

  const total = declared ?? limit
  for (let n = 2; n <= total; n++) {
    const bytes = await fetchBytes(`${src.base}${folder}/${n}.${firstPage.kind}`, signal)
    // Without a declared count, the first gap is the end of the book
    if (!bytes) { if (!declared) break; else continue }
    pages.push({ bytes, kind: firstPage.kind })
    onProgress(pages.length, declared)
  }
  return pages
}
