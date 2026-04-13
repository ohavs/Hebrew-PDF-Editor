// Hebrew date utilities
const MONTHS_HE = [
  'תשרי','חשוון','כסלו','טבת','שבט','אדר','ניסן','אייר','סיוון','תמוז','אב','אלול',
  'אדר א׳','אדר ב׳'
]

const NUMS = ['','א','ב','ג','ד','ה','ו','ז','ח','ט','י','יא','יב','יג','יד','טו','טז','יז','יח','יט','כ','כא','כב','כג','כד','כה','כו','כז','כח','כט','ל']

// Simple Gregorian->Hebrew calendar conversion
function isLeapYear(year: number): boolean {
  return (7 * year + 1) % 19 < 7
}

function getDaysInMonth(month: number, year: number): number {
  if (month === 6 && !isLeapYear(year)) return 0 // Adar only in leap year
  const days = [30,29,30,29,30,29,30,29,30,29,30,29,30,29]
  return days[month] || 30
}

export function toHebrewDateString(date: Date = new Date()): string {
  // Approximate Hebrew date for display purposes
  const day = date.getDate()
  const month = date.getMonth()
  const year = date.getFullYear()

  // Approximate Hebrew year (add 3760 or 3761 depending on month)
  const hebrewYear = year + (month >= 8 ? 3761 : 3760)
  const yearStr = hebrewYear.toString()

  // Hebrew months (approximate - real calculation is complex)
  const hebrewMonths = [
    'טבת','שבט','אדר','ניסן','אייר','סיוון','תמוז','אב','אלול','תשרי','חשוון','כסלו'
  ]

  const hebrewMonth = hebrewMonths[month]
  const dayStr = NUMS[day] || String(day)

  // Year in Hebrew letters (תשפ"ה etc)
  const shortYear = parseInt(yearStr.slice(-3))
  const hebrewYearStr = numToHebrew(shortYear)

  return `${dayStr}' ב${hebrewMonth} ${hebrewYearStr}`
}

function numToHebrew(n: number): string {
  const thousands = Math.floor(n / 1000)
  const rest = n % 1000
  const hundreds = Math.floor(rest / 100)
  const tens = Math.floor((rest % 100) / 10)
  const ones = rest % 10

  const hundredsMap: Record<number, string> = {1:'ק',2:'ר',3:'ש',4:'ת',5:'תק',6:'תר',7:'תש',8:'תת',9:'תתק'}
  const tensMap: Record<number, string> = {1:'י',2:'כ',3:'ל',4:'מ',5:'נ',6:'ס',7:'ע',8:'פ',9:'צ'}
  const onesMap: Record<number, string> = {1:'א',2:'ב',3:'ג',4:'ד',5:'ה',6:'ו',7:'ז',8:'ח',9:'ט'}

  let result = ''
  if (hundreds) result += hundredsMap[hundreds] || ''
  if (tens === 1 && ones === 5) result += 'טו'
  else if (tens === 1 && ones === 6) result += 'טז'
  else {
    if (tens) result += tensMap[tens] || ''
    if (ones) result += onesMap[ones] || ''
  }

  if (result.length > 1) {
    result = result.slice(0, -1) + '"' + result.slice(-1)
  } else if (result.length === 1) {
    result += "'"
  }

  return result
}

export function formatDate(date: Date, format: 'gregorian' | 'hebrew'): string {
  if (format === 'hebrew') return toHebrewDateString(date)
  return date.toLocaleDateString('he-IL', {
    year: 'numeric', month: 'long', day: 'numeric'
  })
}
