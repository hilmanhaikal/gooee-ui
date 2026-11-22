import { prefersReducedMotion } from '../motion'

// ScrollArea's drawn scrollbar with no framework: the thumbs follow the native scroll, fade when idle and
// can be dragged. Every write goes straight to the DOM, so scrolling never re-renders.

export type ScrollAxis = 'y' | 'x'
const IDLE_MS = 900

// A pointer event from the DOM or from React: React's own, so stopPropagation also stops React's handlers.
type Press = Pick<PointerEvent, 'pointerType' | 'button' | 'clientX' | 'clientY' | 'pointerId' | 'preventDefault' | 'stopPropagation'>

type Parts = {
  root: () => HTMLElement | null
  viewport: () => HTMLElement | null
  thumb: (axis: ScrollAxis) => HTMLElement | null
}

// The gooey thumb: a drop that stretches longer and thinner with scroll speed, and squashes against the
// track's end when a fast scroll lands there. Springs bring it back; at rest it is the plain thumb.
const STRETCH_MAX = 0.6
const STRETCH_PER_SPEED = 0.12 // per px/ms of scroll
const SQUASH_PER_SPEED = 0.06
const SQUASH_MAX = 0.28
const QUIET_MS = 90
// Both springs are critically damped (damping = 2 * sqrt(stiffness)), so the thumb settles without a bounce.
const STRETCH_K = 260
const SQUASH_K = 420
const STRETCH_C = 2 * Math.sqrt(STRETCH_K)
const SQUASH_C = 2 * Math.sqrt(SQUASH_K)

type Goo = { pos: number; t: number; aim: number; s: number; sv: number; q: number; qv: number; edge: number; len: number; offset: number; room: number }
const freshGoo = (): Goo => ({ pos: 0, t: 0, aim: 0, s: 0, sv: 0, q: 0, qv: 0, edge: 0, len: 0, offset: 0, room: 0 })

export function createScrollArea({ root, viewport, thumb }: Parts) {
  let idle: number | undefined
  let drag: { axis: ScrollAxis; start: number; scroll: number; ratio: number; pointer: number } | null = null
  const goo: Record<ScrollAxis, Goo> = { y: freshGoo(), x: freshGoo() }
  let frame = 0
  let lastScroll = 0
  let lastTick = 0

  // Writes the thumb's place, and its stretch or squash when it has one. At rest only the translate is
  // written, exactly as before the goo, so a resting thumb looks the same in every framework.
  const paint = (axis: ScrollAxis) => {
    const t = thumb(axis)
    const g = goo[axis]
    if (!t) return
    const k = (1 + g.s) * (1 + g.q)
    if (Math.abs(k - 1) < 0.002) {
      t.style.transformOrigin = ''
      t.style.transform = axis === 'y' ? `translateY(${g.offset}px)` : `translateX(${g.offset}px)`
      return
    }
    const long = g.len * k
    // Stretched, it grows from its middle; squashed, it keeps the end it landed on. It never leaves the track.
    let start = g.edge < 0 && g.q < 0 ? g.offset : g.edge > 0 && g.q < 0 ? g.offset + g.len - long : g.offset + (g.len - long) / 2
    start = Math.min(Math.max(start, 0), Math.max(0, g.room - long))
    const thin = 1 / Math.sqrt(k)
    if (axis === 'y') {
      t.style.transformOrigin = 'center top'
      t.style.transform = `translateY(${start}px) scale(${thin}, ${k})`
    } else {
      t.style.transformOrigin = 'left center'
      t.style.transform = `translateX(${start}px) scale(${k}, ${thin})`
    }
  }

  const tick = (now: number) => {
    const dt = Math.min(0.032, (now - (lastTick || now)) / 1000) || 0.016
    lastTick = now
    let moving = false
    for (const axis of ['y', 'x'] as const) {
      const g = goo[axis]
      const aim = now - lastScroll > QUIET_MS ? 0 : g.aim
      g.sv += ((aim - g.s) * STRETCH_K - g.sv * STRETCH_C) * dt
      g.s = Math.max(0, g.s + g.sv * dt)
      g.qv += (-g.q * SQUASH_K - g.qv * SQUASH_C) * dt
      g.q = Math.max(-SQUASH_MAX, Math.min(SQUASH_MAX, g.q + g.qv * dt))
      const busy = aim > 0 || Math.abs(g.s) > 0.002 || Math.abs(g.sv) > 0.01 || Math.abs(g.q) > 0.002 || Math.abs(g.qv) > 0.01
      if (!busy) {
        g.s = g.sv = g.q = g.qv = 0
        g.edge = 0
      }
      moving ||= busy
      paint(axis)
    }
    frame = moving ? requestAnimationFrame(tick) : 0
    if (!moving) lastTick = 0
  }

  // Reads the scroll speed on each axis and starts the springs.
  const feel = () => {
    const vp = viewport()
    if (!vp || prefersReducedMotion()) return
    const now = performance.now()
    for (const axis of ['y', 'x'] as const) {
      const g = goo[axis]
      const pos = axis === 'y' ? vp.scrollTop : vp.scrollLeft
      const max = (axis === 'y' ? vp.scrollHeight - vp.clientHeight : vp.scrollWidth - vp.clientWidth) || 0
      const dt = now - g.t
      const speed = g.t && dt > 0 && dt < 120 ? (pos - g.pos) / dt : 0
      if (pos !== g.pos && g.t) {
        g.aim = Math.min(STRETCH_MAX, Math.abs(speed) * STRETCH_PER_SPEED)
        // Landing on an end: a squash as deep as the speed it arrived with.
        const atEdge = pos <= 0 ? -1 : pos >= max - 1 ? 1 : 0
        if (atEdge && Math.abs(speed) > 0.3) {
          g.edge = atEdge
          g.aim = 0
          g.s = g.sv = 0
          g.qv = -Math.min(SQUASH_MAX * 30, Math.abs(speed) * SQUASH_PER_SPEED * 30)
        }
      }
      g.pos = pos
      g.t = now
    }
    lastScroll = now
    if (!frame) frame = requestAnimationFrame(tick)
  }

  const update = () => {
    const vp = viewport()
    const el = root()
    if (!vp || !el) return
    const place = (axis: ScrollAxis) => {
      const t = thumb(axis)
      if (!t) return
      const track = t.parentElement as HTMLElement
      const size = axis === 'y' ? vp.clientHeight : vp.clientWidth
      const full = axis === 'y' ? vp.scrollHeight : vp.scrollWidth
      const pos = axis === 'y' ? vp.scrollTop : vp.scrollLeft
      const overflow = full > size + 1
      track.toggleAttribute('data-hidden', !overflow)
      if (!overflow) return
      const pad = parseFloat(getComputedStyle(track).paddingTop) || 0
      const trackLen = (axis === 'y' ? track.clientHeight : track.clientWidth) - pad * 2
      const minThumb = parseFloat(getComputedStyle(el).getPropertyValue('--gooee-scroll-area-thumb-min')) || 24
      const len = Math.max(minThumb, (size / full) * trackLen)
      const offset = (pos / (full - size)) * (trackLen - len)
      if (axis === 'y') t.style.height = `${len}px`
      else t.style.width = `${len}px`
      const g = goo[axis]
      g.len = len
      g.offset = offset
      g.room = trackLen
      paint(axis)
    }
    place('y')
    place('x')
  }

  const wake = () => {
    const el = root()
    if (!el) return
    el.setAttribute('data-scrolling', '')
    window.clearTimeout(idle)
    idle = window.setTimeout(() => {
      if (!drag) el.removeAttribute('data-scrolling')
    }, IDLE_MS)
  }

  /** Places the thumbs now and again whenever the viewport or its content changes size. Returns a cleanup. */
  const observe = () => {
    update()
    const vp = viewport()
    if (!vp) return () => {}
    const ro = new ResizeObserver(update)
    ro.observe(vp)
    if (vp.firstElementChild) ro.observe(vp.firstElementChild)
    return () => ro.disconnect()
  }

  const onScroll = () => {
    feel()
    update()
    wake()
  }

  const thumbDown = (axis: ScrollAxis, e: Press) => {
    const vp = viewport()
    const t = thumb(axis)
    if (!vp || !t || (e.pointerType === 'mouse' && e.button !== 0)) return
    e.preventDefault()
    e.stopPropagation()
    const track = t.parentElement as HTMLElement
    const size = axis === 'y' ? vp.clientHeight : vp.clientWidth
    const full = axis === 'y' ? vp.scrollHeight : vp.scrollWidth
    const pad = parseFloat(getComputedStyle(track).paddingTop) || 0
    const trackLen = (axis === 'y' ? track.clientHeight : track.clientWidth) - pad * 2
    const thumbLen = axis === 'y' ? t.offsetHeight : t.offsetWidth
    // The thumb travels the track minus its own length, which is all the scroll there is.
    drag = {
      axis,
      start: axis === 'y' ? e.clientY : e.clientX,
      scroll: axis === 'y' ? vp.scrollTop : vp.scrollLeft,
      ratio: (full - size) / Math.max(1, trackLen - thumbLen),
      pointer: e.pointerId,
    }
    t.setPointerCapture(e.pointerId)
    root()?.setAttribute('data-dragging', '')
  }

  const thumbMove = (e: Pick<PointerEvent, 'clientX' | 'clientY' | 'pointerId'>) => {
    const vp = viewport()
    if (!drag || !vp || drag.pointer !== e.pointerId) return
    const delta = (drag.axis === 'y' ? e.clientY : e.clientX) - drag.start
    if (drag.axis === 'y') vp.scrollTop = drag.scroll + delta * drag.ratio
    else vp.scrollLeft = drag.scroll + delta * drag.ratio
  }

  const thumbUp = () => {
    if (!drag) return
    thumb(drag.axis)?.releasePointerCapture(drag.pointer)
    drag = null
    root()?.removeAttribute('data-dragging')
    wake()
  }

  // A press on the track pages towards it.
  const trackDown = (axis: ScrollAxis, e: Pick<PointerEvent, 'clientX' | 'clientY'>) => {
    const vp = viewport()
    const t = thumb(axis)
    if (!vp || !t) return
    const r = t.getBoundingClientRect()
    const before = axis === 'y' ? e.clientY < r.top : e.clientX < r.left
    const page = (axis === 'y' ? vp.clientHeight : vp.clientWidth) * 0.9
    vp.scrollBy({ [axis === 'y' ? 'top' : 'left']: before ? -page : page, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }

  const destroy = () => {
    window.clearTimeout(idle)
    cancelAnimationFrame(frame)
    frame = 0
  }

  return { update, wake, observe, onScroll, thumbDown, thumbMove, thumbUp, trackDown, destroy }
}
