// The option lists of Select, Combobox and MultiSelect, with no framework: groups, and drawing only the
// options in view once a list is long.
import { createRowMeasure, drawnRows, rowOffsets } from './virtualList'

/** Past this many options a list draws only what is in view. Shorter lists draw everything and keep their entrance. */
export const WINDOW_AFTER = 100
const OVERSCAN = 8
const OPTION_H = 44
const GROUP_H = 32

export type ListRow = { group: string; at: number; key: string } | { option: number; in?: string; key: string }

/** Lower case with accents taken off, so "cafe" finds "Café" and "e" finds "é". */
export const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** Where `query` sits in `text`, ignoring case and accents, as start and end indexes in `text`; null when it is not there. */
export function matchRange(text: string, query: string): [number, number] | null {
  if (!query) return null
  // Folding can change a string's length, so each folded letter remembers where it came from.
  let folded = ''
  const from: number[] = []
  for (let i = 0; i < text.length; ) {
    const ch = String.fromCodePoint(text.codePointAt(i)!)
    const f = fold(ch)
    for (let j = 0; j < f.length; j++) from.push(i)
    folded += f
    i += ch.length
  }
  const k = folded.indexOf(fold(query))
  if (k < 0) return null
  const end = k + fold(query).length
  return [from[k], end < from.length ? from[end] : text.length]
}

/** Options of the same group sit together, in the order each group first appears. Without groups, the same list. */
export function byGroup<O extends { group?: string }>(options: O[]): O[] {
  if (!options.some((o) => o.group)) return options
  const order = new Map<string, O[]>()
  for (const o of options) {
    const g = o.group ?? ''
    if (!order.has(g)) order.set(g, [])
    order.get(g)!.push(o)
  }
  return [...order.values()].flat()
}

/** One row per option, with a header row before each group. `at` is the index of the group's first option. */
export function listRows<O extends { value: string; group?: string }>(options: O[]): ListRow[] {
  const rows: ListRow[] = []
  let last: string | undefined
  options.forEach((o, i) => {
    if (o.group && o.group !== last) rows.push({ group: o.group, at: i, key: `group:${o.group}` })
    last = o.group
    rows.push({ option: i, in: o.group, key: o.value })
  })
  return rows
}

/** Each option's place within its group (or the whole list), for aria-posinset and aria-setsize. */
export function setPlaces<O extends { group?: string }>(options: O[]) {
  const pos: number[] = []
  const size: number[] = []
  for (let start = 0; start < options.length; ) {
    let end = start
    while (end < options.length && options[end].group === options[start].group) end++
    for (let i = start; i < end; i++) {
      pos[i] = i - start + 1
      size[i] = end - start
    }
    start = end
  }
  return { pos, size }
}

/**
 * Which rows to draw and where. A short list draws every row in the page flow. A long one places the rows in
 * view (and the active option, so it is never lost) by measured height.
 */
export function createOptionWindow(onChange: () => void) {
  const measured = new Map<string, number>()
  let offsets = new Float64Array(1)
  let scroller: HTMLElement | null = null
  const measure = createRowMeasure({ scroller: () => scroller, offsets: () => offsets, measured, pinned: () => false, onChange })
  return {
    /** Lays out the rows and returns the ones to draw, with the list's full height (0 when not windowed). */
    layout(rows: ListRow[], el: HTMLElement | null, active: number) {
      scroller = el
      if (rows.length <= WINDOW_AFTER) return { windowed: false, drawn: rows.map((_, r) => r), offsets, height: 0 }
      // Options not yet drawn are guessed from the ones measured so far, so a jump far down lands close.
      let sum = 0
      let n = 0
      for (const [key, h] of measured) {
        if (key.startsWith('group:')) continue
        sum += h
        n++
      }
      const guess = n ? sum / n : OPTION_H
      offsets = rowOffsets(rows.length, (r) => measured.get(rows[r].key) ?? ('group' in rows[r] ? GROUP_H : guess))
      const activeRow = active < 0 ? -1 : rows.findIndex((row) => 'option' in row && row.option === active)
      const drawn = drawnRows(offsets, rows.length, el?.scrollTop ?? 0, el?.clientHeight ?? 0, OVERSCAN, activeRow).filter((r) => r >= 0)
      // A group's header is drawn with any of its options, so the group always has its name.
      const withHeads = new Set(drawn)
      for (const r of drawn) {
        for (let h = r; h >= 0; h--) {
          if ('group' in rows[h]) {
            withHeads.add(h)
            break
          }
        }
      }
      return { windowed: true, drawn: [...withHeads].sort((a, b) => a - b), offsets, height: offsets[rows.length] }
    },
    observe: (el: Element) => measure?.observe(el),
    unobserve: (el: Element) => measure?.unobserve(el),
    disconnect: () => measure?.disconnect(),
  }
}

/** Splits the drawn rows into runs: one per group, which gets a role="group" wrapper, and runs of options with no group. */
export function groupRuns(rows: ListRow[], drawn: number[]) {
  const runs: { head?: number; group?: string; rows: number[] }[] = []
  for (const r of drawn) {
    const row = rows[r]
    const last = runs[runs.length - 1]
    if ('group' in row) runs.push({ head: r, group: row.group, rows: [] })
    else if (last && last.group === row.in) last.rows.push(r)
    else runs.push({ group: row.in, rows: [r] })
  }
  return runs
}
