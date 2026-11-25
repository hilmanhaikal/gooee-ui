// Gooee UI, MIT licence. https://gooee.dev
'use client'

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { createOptionWindow, groupRuns, listRows, setPlaces } from './motion/optionList'
import styles from './OptionList.module.css'

export type OptionPlace = {
  ref: (el: HTMLElement | null) => (() => void) | undefined
  style?: CSSProperties
  'aria-posinset': number
  'aria-setsize': number
  'data-index': number
  'data-key': string
}

type Props<O> = {
  /** The options to show, in order. Options of a group must sit together (byGroup). */
  options: O[]
  /** Index of the highlighted option, or -1. */
  active: number
  /** The scrolling list element. */
  list: RefObject<HTMLElement | null>
  /** The part's own class for the moving highlight. */
  highlightClass: string
  /** Prefix for data-slot, such as "combobox". */
  part: string
  baseId: string
  /** Draws one option. Spread `place` onto its element. */
  children: (option: O, index: number, place: OptionPlace) => ReactNode
}

// The rows of a Select, Combobox or MultiSelect list: the highlight that moves between options, groups with
// their names, and only the options in view once the list is long (motion/optionList.ts).
export function OptionList<O extends { value: string; group?: string }>({ options, active, list, highlightClass, part, baseId, children }: Props<O>) {
  const [, redraw] = useState(0)
  const win = useRef<ReturnType<typeof createOptionWindow> | null>(null)
  if (!win.current) win.current = createOptionWindow(() => redraw((v) => v + 1))
  const els = useRef(new Map<number, HTMLElement>())
  const rows = useMemo(() => listRows(options), [options])
  const places = useMemo(() => setPlaces(options), [options])
  const { windowed, drawn, offsets, height } = win.current.layout(rows, list.current, active)
  const [hl, setHl] = useState<{ top: number; height: number } | null>(null)

  useEffect(() => () => win.current?.disconnect(), [])

  // A long list draws again as it scrolls; a short one has nothing to redraw.
  useLayoutEffect(() => {
    const el = list.current
    if (!el || !windowed) return
    const onScroll = () => redraw((v) => v + 1)
    el.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => el.removeEventListener('scroll', onScroll)
  }, [windowed])

  useLayoutEffect(() => {
    const el = els.current.get(active)
    const next = el ? { top: el.offsetTop, height: el.offsetHeight } : null
    setHl((h) => (h?.top === next?.top && h?.height === next?.height ? h : next))
  })

  // The active option stays in view while rows above it are measured, until the person scrolls the list.
  const pinned = useRef(false)
  useLayoutEffect(() => {
    pinned.current = true
  }, [active, options])
  useLayoutEffect(() => {
    if (pinned.current) els.current.get(active)?.scrollIntoView({ block: 'nearest' })
  })
  useLayoutEffect(() => {
    const el = list.current
    if (!el) return
    const unpin = () => void (pinned.current = false)
    el.addEventListener('wheel', unpin, { passive: true })
    el.addEventListener('touchstart', unpin, { passive: true })
    el.addEventListener('pointerdown', unpin)
    return () => {
      el.removeEventListener('wheel', unpin)
      el.removeEventListener('touchstart', unpin)
      el.removeEventListener('pointerdown', unpin)
    }
  }, [])

  const track = (i: number | null) => (el: HTMLElement | null) => {
    if (!el) return
    if (i !== null) els.current.set(i, el)
    if (windowed) win.current!.observe(el)
    return () => {
      if (i !== null && els.current.get(i) === el) els.current.delete(i)
      win.current!.unobserve(el)
    }
  }
  const at = (r: number): CSSProperties | undefined => (windowed ? { position: 'absolute', top: offsets[r], left: 0, right: 0 } : undefined)

  const body = (
    <>
      {hl && <span className={highlightClass} data-slot={`${part}-highlight`} style={{ transform: `translateY(${hl.top}px)`, height: hl.height, ...(windowed && { left: 0, right: 0 }) }} aria-hidden="true" />}
      {groupRuns(rows, drawn).map((run, n) => {
        const items = run.rows.map((r) => {
          const row = rows[r] as { option: number; key: string }
          const i = row.option
          return <Fragment key={row.key}>{children(options[i], i, { ref: track(i), style: at(r), 'aria-posinset': places.pos[i], 'aria-setsize': places.size[i], 'data-index': r, 'data-key': row.key })}</Fragment>
        })
        if (run.head === undefined) return <Fragment key={`run${n}`}>{items}</Fragment>
        const head = rows[run.head]
        const id = `${baseId}-group-${run.head}`
        return (
          <div key={head.key} role="group" aria-labelledby={id} data-slot={`${part}-group`}>
            <div ref={track(null)} id={id} role="presentation" data-index={run.head} data-key={head.key} data-slot={`${part}-group-label`} className={styles.groupLabel} style={at(run.head)}>
              {'group' in head && head.group}
            </div>
            {items}
          </div>
        )
      })}
    </>
  )
  return windowed ? <div className={styles.space} style={{ height }}>{body}</div> : body
}
