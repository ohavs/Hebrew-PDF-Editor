// PDF → XLSX, fully client-side.
//
// A PDF has no table structure to read — only glyphs at coordinates. So the
// rows come from clustering text by baseline, and the columns from the x
// positions those rows actually use. That recovers ordinary ruled tables
// (invoices, bank statements, price lists) well; merged cells and nested
// tables come out flattened.
import { zipSync, strToU8 } from 'fflate'

export interface SheetPage {
  name: string
  rows: string[][]
}

const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Excel rejects control characters outright
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')

interface Cell { x: number; right: number; str: string }

/** Read every page of a pdf.js document as a grid of cells. */
export async function extractTables(pdfDoc: any): Promise<SheetPage[]> {
  const pages: SheetPage[] = []
  for (let p = 1; p <= pdfDoc.numPages; p++) {
    const page = await pdfDoc.getPage(p)
    const content = await page.getTextContent()

    // Group glyph runs into lines by baseline (same tolerance as the Word path)
    const lines = new Map<number, Cell[]>()
    for (const item of content.items as any[]) {
      if (!item.str?.trim()) continue
      const y = Math.round(item.transform[5] / 4) * 4
      if (!lines.has(y)) lines.set(y, [])
      lines.get(y)!.push({
        x: item.transform[4],
        right: item.transform[4] + (item.width || 0),
        str: item.str,
      })
    }
    page.cleanup?.()

    const ordered = [...lines.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, cells]) => cells.sort((a, b) => a.x - b.x))
    if (!ordered.length) { pages.push({ name: `עמוד ${p}`, rows: [] }); continue }

    const bounds = columnBounds(ordered)
    const rows = ordered.map(cells => {
      const row: string[] = new Array(bounds.length).fill('')
      for (const c of cells) {
        const col = columnFor(c.x, bounds)
        row[col] = row[col] ? `${row[col]} ${c.str}`.trim() : c.str.trim()
      }
      return row
    })
    pages.push({ name: `עמוד ${p}`, rows })
  }
  return pages
}

/**
 * Column starts, found by clustering the left edge of every run. Runs whose
 * left edges sit within a hair of each other belong to the same column even
 * though no two lines ever agree exactly.
 */
function columnBounds(lines: Cell[][]): number[] {
  const TOLERANCE = 12 // points — narrower than any realistic column gutter
  const starts: number[] = []
  for (const line of lines) {
    for (const c of line) {
      const near = starts.find(s => Math.abs(s - c.x) < TOLERANCE)
      if (near === undefined) starts.push(c.x)
    }
  }
  starts.sort((a, b) => a - b)

  // Merge any that ended up adjacent after sorting
  const merged: number[] = []
  for (const s of starts) {
    if (!merged.length || s - merged[merged.length - 1] >= TOLERANCE) merged.push(s)
  }
  return merged
}

function columnFor(x: number, bounds: number[]): number {
  let best = 0
  let bestDist = Infinity
  bounds.forEach((b, i) => {
    const d = Math.abs(b - x)
    if (d < bestDist) { bestDist = d; best = i }
  })
  return best
}

/** A1, B1 … Z1, AA1 — Excel's column naming. */
function cellRef(col: number, row: number): string {
  let name = ''
  let n = col
  do {
    name = String.fromCharCode(65 + (n % 26)) + name
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return `${name}${row + 1}`
}

/** Build a minimal but valid .xlsx — one worksheet per PDF page. */
export function buildXlsx(pages: SheetPage[]): Uint8Array {
  const sheets = pages.length ? pages : [{ name: 'גיליון 1', rows: [] }]

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
</Types>`

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
${sheets.map((s, i) => `<sheet name="${xmlEscape(sheetName(s.name, i))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('\n')}
</sheets>
</workbook>`

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n')}
</Relationships>`

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(rootRels),
    'xl/workbook.xml': strToU8(workbook),
    'xl/_rels/workbook.xml.rels': strToU8(workbookRels),
  }

  sheets.forEach((sheet, si) => {
    const rowsXml = sheet.rows.map((row, ri) => {
      const cells = row
        .map((value, ci) => {
          if (!value) return ''
          // Inline strings: no shared-string table to keep in sync, and
          // Hebrew survives as plain UTF-8
          return `<c r="${cellRef(ci, ri)}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`
        })
        .join('')
      return cells ? `<row r="${ri + 1}">${cells}</row>` : ''
    }).join('\n')

    files[`xl/worksheets/sheet${si + 1}.xml`] = strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>
${rowsXml}
</sheetData>
</worksheet>`)
  })

  return zipSync(files)
}

/** Excel forbids : \ / ? * [ ] in sheet names and caps them at 31 chars. */
function sheetName(name: string, index: number): string {
  const clean = name.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31).trim()
  return clean || `גיליון ${index + 1}`
}
