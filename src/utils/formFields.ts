import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { FormField, Rect } from '../store/types'

/**
 * Read the AcroForm widgets out of a PDF and turn them into the app's own
 * FormField records.
 *
 * Coordinates come back in display space — CSS pixels at zoom 1, origin
 * top-left, on the page as it is shown (i.e. after the intrinsic /Rotate) —
 * which is the same space annotations live in, so the overlay and the
 * exporter both work without extra conversion.
 */
export async function detectFormFields(pdf: PDFDocumentProxy): Promise<FormField[]> {
  const fields: FormField[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    let annots: any[]
    try {
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: 1 })
      annots = await page.getAnnotations({ intent: 'any' })

      for (const a of annots) {
        if (a.subtype !== 'Widget') continue
        // Signature and push-button widgets have nothing to fill in
        if (a.fieldType === 'Sig' || a.pushButton || a.hidden || a.readOnly) continue

        const type = widgetType(a)
        if (!type) continue

        const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(a.rect)
        const rect: Rect = {
          x: Math.min(x1, x2),
          y: Math.min(y1, y2),
          width: Math.abs(x2 - x1),
          height: Math.abs(y2 - y1),
        }
        // Degenerate widgets exist in the wild and would be unclickable
        if (rect.width < 4 || rect.height < 4) continue

        fields.push({
          id: `pdf-${a.id}`,
          pageIndex: i - 1,
          type,
          rect,
          name: a.fieldName || `שדה ${fields.length + 1}`,
          value: initialValue(a, type),
          options: type === 'dropdown'
            ? (a.options || []).map((o: any) => o.displayValue || o.exportValue || o.value || '')
            : type === 'radio'
            ? [a.buttonValue || 'On']
            : undefined,
          required: !!a.required,
          placeholder: '',
          pdfFieldRef: a.id,
        })
      }
    } catch (e) {
      console.warn('form field scan failed on page', i, e)
    }
  }

  return fields
}

function widgetType(a: any): FormField['type'] | null {
  if (a.fieldType === 'Tx') return 'text'
  if (a.fieldType === 'Ch') return 'dropdown'
  if (a.fieldType === 'Btn') return a.radioButton ? 'radio' : a.checkBox ? 'checkbox' : null
  return null
}

function initialValue(a: any, type: FormField['type']): string | boolean {
  if (type === 'checkbox') return !!a.fieldValue && a.fieldValue !== 'Off'
  if (type === 'radio') return a.fieldValue != null && a.fieldValue === a.buttonValue
  const v = a.fieldValue
  return typeof v === 'string' ? v : Array.isArray(v) ? (v[0] ?? '') : ''
}

/**
 * Radio widgets that share a field name are one choice group — used by the
 * overlay so picking one clears its siblings.
 */
export function radioSiblings(fields: FormField[], field: FormField): FormField[] {
  return fields.filter(f => f.type === 'radio' && f.name === field.name)
}
