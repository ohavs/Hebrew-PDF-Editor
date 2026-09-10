import type { PageNumberSettings } from '../store'

/**
 * The running header or footer a document carries: page numbers, a title, a
 * date, or any mix of them.
 *
 * It stays a live setting rather than ink until the file is exported, which is
 * what makes it survive editing — add or remove a page and the numbers follow,
 * because each page works out its own number from where it sits now. Baked-in
 * numbers cannot do that, which is the whole reason this is not simply text.
 *
 * The same three functions drive the on-screen layer and the export, so what
 * is seen and what is written cannot drift apart.
 */

export type StampVertical = 'top' | 'bottom'
export type StampHorizontal = 'left' | 'center' | 'right'
export type DateFormat = 'dd/mm/yyyy' | 'yyyy-mm-dd' | 'long'

/** What a setting means when the document does not say. */
export const STAMP_DEFAULTS = {
  template: '{n}',
  vertical: 'bottom' as StampVertical,
  fontFamily: 'Heebo',
  fontSize: 11,
  color: '#595959',
  bold: false,
  fromPage: 1,
  toPage: null as number | null,
  dateFormat: 'dd/mm/yyyy' as DateFormat,
  margin: 34,
}

/** Every setting resolved, so callers never repeat the fallbacks. */
export function stampConfig(s: PageNumberSettings) {
  return {
    template: s.template ?? STAMP_DEFAULTS.template,
    vertical: s.vertical ?? STAMP_DEFAULTS.vertical,
    horizontal: (s.position === 'center' ? 'center' : s.position) as StampHorizontal,
    fontFamily: s.fontFamily ?? STAMP_DEFAULTS.fontFamily,
    fontSize: s.fontSize ?? STAMP_DEFAULTS.fontSize,
    color: s.color ?? STAMP_DEFAULTS.color,
    bold: s.bold ?? STAMP_DEFAULTS.bold,
    fromPage: s.fromPage ?? STAMP_DEFAULTS.fromPage,
    toPage: s.toPage ?? STAMP_DEFAULTS.toPage,
    dateFormat: s.dateFormat ?? STAMP_DEFAULTS.dateFormat,
    margin: s.margin ?? STAMP_DEFAULTS.margin,
    startAt: s.startAt,
    dx: s.dx,
    dy: s.dy,
  }
}

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

export function formatDate(d: Date, format: DateFormat): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  if (format === 'yyyy-mm-dd') return `${yyyy}-${mm}-${dd}`
  if (format === 'long') return `${d.getDate()} ב${HEBREW_MONTHS[d.getMonth()]} ${yyyy}`
  return `${dd}/${mm}/${yyyy}`
}

/** Whether this page carries the stamp at all. */
export function stampApplies(s: PageNumberSettings, displayPos: number, total: number): boolean {
  const c = stampConfig(s)
  const page = displayPos + 1
  if (page < c.fromPage) return false
  if (c.toPage != null && page > Math.min(c.toPage, total)) return false
  return true
}

/**
 * What the stamp reads on a given page.
 *
 * `{n}` is the page's own number, counting from the chosen start; `{total}`
 * the number of pages; `{date}` today. Anything else is written as typed, so a
 * plain title needs no tokens at all.
 */
export function stampText(
  s: PageNumberSettings,
  displayPos: number,
  total: number,
  now = new Date(),
): string {
  const c = stampConfig(s)
  return c.template
    .replace(/\{n\}/g, String(c.startAt + displayPos))
    .replace(/\{total\}/g, String(total))
    .replace(/\{date\}/g, formatDate(now, c.dateFormat))
}

/**
 * Where the stamp sits, in display coordinates with the origin top-left.
 *
 * The anchor picks a corner or edge and the drag offset moves it from there,
 * so nudging one page's stamp nudges every page's the same way.
 */
export function stampPosition(
  s: PageNumberSettings,
  displayWidth: number,
  displayHeight: number,
  textWidth: number,
): { x: number; y: number } {
  const c = stampConfig(s)
  const x = c.horizontal === 'center' ? (displayWidth - textWidth) / 2
    : c.horizontal === 'right' ? displayWidth - c.margin - textWidth
      : c.margin
  const y = c.vertical === 'top' ? c.margin - c.fontSize : displayHeight - c.margin
  return { x: x + c.dx, y: y + c.dy }
}

/** True when the text needs a real font rather than a built-in Latin one. */
export const needsHebrewFont = (text: string) => /[֐-׿؀-ۿ]/.test(text)
