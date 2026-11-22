// Gooee UI, MIT licence. https://gooee.dev
import { rubber, speedTracker } from '../feel'
import { easing, motionMs } from '../motion'
import { release } from './fling'

const SWIPE = 72
const CLOSE_DRAG = 120
// px per second: a flick this fast changes the photo or closes it, however short.
const FLICK = 500

type PointerLike = Pick<PointerEvent, 'clientX' | 'clientY' | 'pointerId' | 'pointerType' | 'button' | 'type'> & { target: EventTarget | null; currentTarget: EventTarget | null }

export type LightboxRead = { index: number | null; total: number; getOrigin?: (index: number) => HTMLElement | null }

function rectTransform(from: DOMRect, to: DOMRect) {
  const s = from.width / Math.max(1, to.width)
  const dx = from.left + from.width / 2 - (to.left + to.width / 2)
  const dy = from.top + from.height / 2 - (to.top + to.height / 2)
  return `translate(${dx}px, ${dy}px) scale(${s})`
}

const visible = (el: HTMLElement | null | undefined) => {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight ? r : null
}

/** Loads the photos either side of `shown`, so paging to them is instant. */
export function preloadAround(shown: number, srcs: string[]) {
  for (const n of [shown - 1, shown + 1]) {
    if (n >= 0 && n < srcs.length) document.createElement('img').src = srcs[n]
  }
}

/**
 * The photo viewer's motion: it zooms out of its thumbnail and back in, pages by swipe and keys, and
 * closes on a pull down. `read` gives the open index, the count and the thumbnails now; `setIndex` gets a
 * new index, or null to close. Wire `down`, `move` and `up` to the stage's pointer events (up to cancel
 * too) and `key` to the viewer's keydown.
 */
export function createLightbox(img: () => HTMLImageElement | null, scrim: () => HTMLElement | null, read: () => LightboxRead, setIndex: (index: number | null) => void) {
  let drag: { x: number; y: number; dx: number; dy: number; axis: 'x' | 'y' | null; id: number; onBackdrop: boolean; speed: ReturnType<typeof speedTracker> } | null = null
  // Where the photo is drawn by a drag or its glide: along one axis, `v` px from its place.
  let pos: { axis: 'x' | 'y' | null; v: number } = { axis: null, v: 0 }
  let stop = () => {}

  const draw = (axis: 'x' | 'y', v: number) => {
    const el = img()
    if (!el) return
    pos = { axis: v ? axis : null, v }
    if (axis === 'x') return void (el.style.transform = v ? `translateX(${v}px)` : '')
    const dy = Math.max(0, v)
    el.style.transform = dy ? `translateY(${dy}px) scale(${1 - Math.min(dy / 1200, 0.15)})` : ''
    const s = scrim()
    if (s) s.style.opacity = dy ? String(1 - Math.min(dy / 400, 0.6)) : ''
  }

  const go = (n: number) => {
    const { index, total } = read()
    if (n < 0 || n >= total || n === index) return
    // An arrow key mid-glide: the next photo starts in its place, not where the old one was going.
    stop()
    if (pos.axis) draw(pos.axis, 0)
    setIndex(n)
  }

  return {
    go,
    /** The photo zooms out of the thumbnail at `index`, once it has decoded. */
    zoomIn(index: number) {
      const el = img()
      if (!el) return
      const ms = motionMs('morph')
      const run = () => {
        const from = visible(read().getOrigin?.(index))
        const to = el.getBoundingClientRect()
        el.style.opacity = ''
        if (!ms || !el.animate) return
        el.animate(
          from ? [{ transform: rectTransform(from, to), opacity: 0.6 }, { transform: 'none', opacity: 1 }] : [{ transform: 'scale(0.92)', opacity: 0 }, { transform: 'none', opacity: 1 }],
          { duration: ms, easing: easing('morph') },
        )
      }
      el.style.opacity = '0'
      el.decode().then(run, run)
    },
    /** The photo shrinks back into the thumbnail at `shown`; `done` runs at the end. */
    zoomOut(shown: number, done: () => void) {
      const el = img()
      const ms = motionMs('morph-out')
      const finish = () => {
        stop()
        pos = { axis: null, v: 0 }
        done()
      }
      scrim()?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: easing('morph'), fill: 'forwards' })
      if (!el || !ms || !el.animate) return finish()
      const to = visible(read().getOrigin?.(shown))
      const from = el.getBoundingClientRect()
      const start = getComputedStyle(el).transform
      el.animate(
        to
          ? [{ transform: start === 'none' ? 'none' : start }, { transform: rectTransform(to, from), opacity: 0.4 }]
          : [{ transform: start === 'none' ? 'none' : start, opacity: 1 }, { transform: 'scale(0.92)', opacity: 0 }],
        { duration: ms, easing: easing('morph'), fill: 'forwards' },
      ).onfinish = finish
    },
    /** True when the key paged; the caller then prevents the default. */
    key(key: string) {
      const { index, total } = read()
      if (key === 'ArrowRight') go((index ?? 0) + 1)
      else if (key === 'ArrowLeft') go((index ?? 0) - 1)
      else if (key === 'Home') go(0)
      else if (key === 'End') go(total - 1)
      else return false
      return true
    },
    down(e: PointerLike) {
      if ((e.target as HTMLElement).closest('button') || (e.pointerType === 'mouse' && e.button !== 0)) return
      // Caught mid-glide, it carries on from where it is, along the same axis.
      stop()
      const { axis, v } = pos
      const x = e.clientX - (axis === 'x' ? v : 0)
      const y = e.clientY - (axis === 'y' ? v : 0)
      drag = { x, y, dx: 0, dy: 0, axis, id: e.pointerId, onBackdrop: e.target === e.currentTarget, speed: speedTracker() }
      if (axis) drag.speed.add(v)
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    move(e: PointerLike) {
      const d = drag
      const el = img()
      if (!d || !el || d.id !== e.pointerId) return
      const { index, total } = read()
      d.dx = e.clientX - d.x
      d.dy = e.clientY - d.y
      if (!d.axis && Math.hypot(d.dx, d.dy) > 8) d.axis = Math.abs(d.dx) > Math.abs(d.dy) ? 'x' : 'y'
      if (!d.axis) return
      let v = d.axis === 'x' ? d.dx : Math.max(0, d.dy)
      // Past the first or last photo it still moves, less the further it goes.
      if (d.axis === 'x' && ((v > 0 && index === 0) || (v < 0 && index === total - 1))) v = rubber(v, el.offsetWidth / 4)
      d.speed.add(v)
      draw(d.axis, v)
    },
    up(e: PointerLike) {
      const d = drag
      drag = null
      if (!d || !img()) return
      if (!d.axis) {
        if (d.onBackdrop) setIndex(null)
        return
      }
      const { index, total } = read()
      const v = pos.v
      const speed = e.type === 'pointercancel' ? 0 : d.speed.speed()
      // A flick counts as well as a long pull, when it goes the same way as the drag.
      const flicked = Math.abs(speed) > FLICK && Math.abs(v) > 24 && Math.sign(speed) === Math.sign(v)
      if (d.axis === 'x' && (Math.abs(v) > SWIPE || flicked) && (v < 0 ? index !== total - 1 : index !== 0)) {
        draw('x', 0)
        go((index ?? 0) + (v < 0 ? 1 : -1))
        return
      }
      if (d.axis === 'y' && (v > CLOSE_DRAG || flicked)) {
        setIndex(null)
        return
      }
      const axis = d.axis
      stop = release(v, 0, speed, (n) => draw(axis, n))
    },
    destroy: () => stop(),
  }
}
