// VirtualList's windowing maths, row measuring, scroll alignment and keys, with no framework.

export type VirtualListAlign = 'start' | 'center' | 'end' | 'nearest'

/** Last index whose top is at or above y. */
export function indexAt(offsets: Float64Array, count: number, y: number) {
  let lo = 0
  let hi = count - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (offsets[mid] <= y) lo = mid
    else hi = mid - 1
  }
  return lo
}

/** The top of every row, and the full height at the end. */
export function rowOffsets(count: number, heightOf: (i: number) => number) {
  const out = new Float64Array(count + 1)
  for (let i = 0; i < count; i++) out[i + 1] = out[i] + heightOf(i)
  return out
}

/** The rows to draw: those in view plus the overscan, and the focused row so focus is never lost. */
export function drawnRows(offsets: Float64Array, count: number, scrollTop: number, viewport: number, overscan: number, active: number) {
  const first = count ? Math.max(0, indexAt(offsets, count, scrollTop) - overscan) : 0
  const last = count ? Math.min(count - 1, indexAt(offsets, count, scrollTop + viewport) + overscan) : -1
  const drawn: number[] = []
  if (count && active < first) drawn.push(active)
  for (let i = first; i <= last; i++) drawn.push(i)
  if (count && active > last) drawn.push(active)
  return drawn
}

/** Where the scroll must be for row i to sit at `how` in the view. */
export function alignedScroll(offsets: Float64Array, i: number, how: VirtualListAlign, scrollTop: number, view: number) {
  const top = offsets[i]
  const h = offsets[i + 1] - top
  if (how === 'start') return top
  if (how === 'end') return top + h - view
  if (how === 'center') return top + h / 2 - view / 2
  if (top < scrollTop) return top
  if (top + h > scrollTop + view) return top + h - view
  return scrollTop
}

/** The row a key moves focus to from row i, or undefined for other keys. */
export function keyTarget(key: string, i: number, offsets: Float64Array, count: number, viewport: number): number | undefined {
  const pageDown = Math.max(i + 1, indexAt(offsets, count, offsets[i] + viewport))
  const pageUp = Math.min(i - 1, indexAt(offsets, count, Math.max(0, offsets[i + 1] - viewport)))
  const to: Record<string, number> = { ArrowDown: i + 1, ArrowUp: i - 1, PageDown: pageDown, PageUp: pageUp, Home: 0, End: count - 1 }
  return key in to ? to[key] : undefined
}

/**
 * Measures drawn rows (data-key, data-index) as they change height. Rows above the view that change height
 * would push the rows in view down, so the scroll moves with them, unless a jump has pinned it.
 */
export function createRowMeasure(o: { scroller: () => HTMLElement | null; offsets: () => Float64Array; measured: Map<string, number>; pinned: () => boolean; onChange: () => void }) {
  if (typeof ResizeObserver === 'undefined') return null
  return new ResizeObserver((entries) => {
    const el = o.scroller()
    const offsets = o.offsets()
    let changed = false
    let shift = 0
    for (const entry of entries) {
      const row = entry.target as HTMLElement
      const key = row.dataset.key
      const index = Number(row.dataset.index)
      if (key === undefined) continue
      const h = entry.borderBoxSize?.[0]?.blockSize ?? row.offsetHeight
      const before = o.measured.get(key) ?? offsets[index + 1] - offsets[index]
      if (Math.abs(before - h) < 0.5) continue
      o.measured.set(key, h)
      changed = true
      if (el && offsets[index] < el.scrollTop) shift += h - before
    }
    if (el && shift && !o.pinned()) el.scrollTop += shift
    if (changed) o.onChange()
  })
}
