// Hebrew text detection and utilities

const HEBREW_RANGE = /[\u0590-\u05FF\uFB1D-\uFB4F]/
const ARABIC_RANGE = /[\u0600-\u06FF]/

export function detectTextDirection(text: string): 'rtl' | 'ltr' {
  for (const char of text) {
    if (HEBREW_RANGE.test(char) || ARABIC_RANGE.test(char)) return 'rtl'
    if (/[A-Za-z]/.test(char)) return 'ltr'
  }
  return 'rtl' // default for this app
}

export function isHebrew(text: string): boolean {
  return HEBREW_RANGE.test(text)
}

export function getFirstCharDirection(text: string): 'rtl' | 'ltr' {
  for (const char of text) {
    if (char.trim() === '') continue
    if (HEBREW_RANGE.test(char) || ARABIC_RANGE.test(char)) return 'rtl'
    return 'ltr'
  }
  return 'rtl'
}

export const HEBREW_FONTS = [
  'Heebo',
  'Frank Ruhl Libre',
  'Noto Sans Hebrew',
  'Assistant',
  'Arial Hebrew',
  'David',
  'Miriam',
  'Times New Roman',
  'Arial',
  'Helvetica'
]

export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48, 56, 64, 72, 96]

export function getFontCSSString(font: string, size: number, bold: boolean, italic: boolean): string {
  return `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${size}px '${font}', 'Heebo', sans-serif`
}
