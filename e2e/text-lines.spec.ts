import { test, expect } from '@playwright/test'
import { groupIntoLines, toEditable, type Run } from '../src/utils/textEdit'

/**
 * How runs of glyphs become editable lines.
 *
 * This is the half of "edit existing text" that has nothing to do with the
 * browser, and it is the half that Hebrew depends on: pdf.js hands back runs
 * in visual order, so a right-to-left line has to be read the other way round
 * or the words come out reversed. Embedding a Hebrew font in a fixture PDF is
 * not possible here, so the runs are built directly.
 */

function run(x: number, str: string, opts: Partial<Run> = {}): Run {
  const height = opts.height ?? 16
  const baseline = opts.baseline ?? 100
  return {
    x,
    y: baseline - height,
    width: opts.width ?? str.length * 7,
    height,
    baseline,
    str,
  }
}

test.describe('grouping text runs into lines', () => {
  test('a Hebrew line reads right to left, not as painted', async () => {
    // Painted left to right: the last word of the sentence sits leftmost
    const runs = [run(10, 'העולם'), run(60, 'שלום')]
    const [line] = groupIntoLines(runs)
    expect(toEditable(line)).toMatchObject({ rtl: true, text: 'שלום העולם' })
  })

  test('a Latin line keeps the order it was painted in', async () => {
    const runs = [run(10, 'Hello '), run(60, 'world')]
    const [line] = groupIntoLines(runs)
    expect(toEditable(line)).toMatchObject({ rtl: false, text: 'Hello world' })
  })

  test('a run touching the next one is not given a space it never had', async () => {
    // "co" then "operate" painted flush against each other
    const runs = [run(10, 'co', { width: 14 }), run(24, 'operate', { width: 49 })]
    const [line] = groupIntoLines(runs)
    expect(toEditable(line).text).toBe('cooperate')
  })

  test('runs a hair apart in baseline are still one line', async () => {
    const runs = [run(10, 'one', { baseline: 100 }), run(50, 'two', { baseline: 102 })]
    expect(groupIntoLines(runs)).toHaveLength(1)
  })

  test('separate rows stay separate lines', async () => {
    const runs = [run(10, 'top', { baseline: 100 }), run(10, 'below', { baseline: 128 })]
    expect(groupIntoLines(runs)).toHaveLength(2)
  })

  test('columns sharing a baseline do not merge into one line', async () => {
    // Three cells across a page — grouped by baseline alone this is one line
    // stretching from x=10 to x=470, and editing any cell would swallow the row
    const runs = [run(10, 'Left'), run(240, 'Middle'), run(420, 'Right')]
    const lines = groupIntoLines(runs)
    expect(lines).toHaveLength(3)
    expect(lines.map(l => toEditable(l).text)).toEqual(['Left', 'Middle', 'Right'])
    expect(lines[0].rect.width).toBeLessThan(60)
  })

  test('ordinary word spacing does not split a line', async () => {
    // A space is nothing like a column gap
    const runs = [run(10, 'some'), run(48, 'words'), run(96, 'here')]
    expect(groupIntoLines(runs)).toHaveLength(1)
  })

  test('the font size follows the tallest run on the line', async () => {
    const runs = [run(10, 'small', { height: 12 }), run(60, 'BIG', { height: 24 })]
    const [line] = groupIntoLines(runs)
    expect(toEditable(line).fontSize).toBe(Math.round(24 * 0.78))
  })

  test('the rectangle covers every run on the line', async () => {
    const runs = [run(10, 'abc', { width: 30 }), run(50, 'def', { width: 30 })]
    const [line] = groupIntoLines(runs)
    expect(line.rect.x).toBe(10)
    expect(line.rect.width).toBe(70)
  })
})
