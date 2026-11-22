// Gooee UI, MIT licence. https://gooee.dev
/** Where the photo sits in the frame. x and y are the point of the photo at the frame's centre, from 0 to 1 of its width and height. */
export type ImageCrop = { x: number; y: number; zoom: number }

/** The part of the photo inside the frame, in the photo's own pixels. */
export type CropArea = { x: number; y: number; width: number; height: number }

export type CropSize = { width: number; height: number }

export type CropperRead = { size: CropSize | null; aspect: number; minZoom: number; maxZoom: number }

type PointerLike = Pick<PointerEvent, 'clientX' | 'clientY' | 'pointerId' | 'pointerType' | 'button' | 'type'> & { currentTarget: EventTarget | null }

export const centreCrop: ImageCrop = { x: 0.5, y: 0.5, zoom: 1 }
export const BUTTON_ZOOM = 1.25
const KEY_PAN = 0.05
const KEY_PAN_BIG = 0.2
const KEY_ZOOM = 1.1
const WHEEL_ZOOM = 0.002
// A press that moves less than this many px is a tap, not a drag.
const TAP_SLOP = 4

// How much of the photo's width and height the frame shows at zoom 1.
export function coverFraction(size: CropSize, aspect: number) {
  const ratio = size.width / size.height
  return { fw: Math.min(1, aspect / ratio), fh: Math.min(1, ratio / aspect) }
}

export function clampCrop(crop: ImageCrop, size: CropSize | null, aspect: number, minZoom: number, maxZoom: number): ImageCrop {
  const zoom = Math.min(maxZoom, Math.max(minZoom, crop.zoom))
  if (!size) return { ...crop, zoom }
  const { fw, fh } = coverFraction(size, aspect)
  // half: half the frame, as a fraction of the photo. Over 0.5, the photo is smaller than the frame on that side.
  const keepIn = (v: number, half: number) => (half >= 0.5 ? 0.5 : Math.min(1 - half, Math.max(half, v)))
  return { zoom, x: keepIn(crop.x, fw / zoom / 2), y: keepIn(crop.y, fh / zoom / 2) }
}

/** The crop as a rectangle in the photo's own pixels, ready for canvas drawImage. */
export function getCropArea(crop: ImageCrop, image: CropSize, aspect: number): CropArea {
  const { fw, fh } = coverFraction(image, aspect)
  const width = (fw / crop.zoom) * image.width
  const height = (fh / crop.zoom) * image.height
  // Both edges are rounded, so x + width never passes the photo's edge.
  const left = Math.round(crop.x * image.width - width / 2)
  const top = Math.round(crop.y * image.height - height / 2)
  return {
    x: left,
    y: top,
    width: Math.round(crop.x * image.width + width / 2) - left,
    height: Math.round(crop.y * image.height + height / 2) - top,
  }
}

/** The img's size and place for a crop, or undefined before the photo's size is known. */
export function cropImageStyle(crop: ImageCrop, size: CropSize | null, aspect: number) {
  if (!size) return undefined
  const fit = coverFraction(size, aspect)
  return {
    width: `${(crop.zoom / fit.fw) * 100}%`,
    height: `${(crop.zoom / fit.fh) * 100}%`,
    transform: `translate(${-crop.x * 100}%, ${-crop.y * 100}%)`,
  }
}

/**
 * Drag, pinch, wheel, tap and keys for the crop frame. `read` gives the photo size and limits now; `commit`
 * gets each new crop; `onActive` says when a press starts and ends. Call `sync` with the crop on every
 * render, since several moves can arrive before the host renders again. Wire `down`, `move` and `up` to
 * the frame's pointer events (up to cancel too), `wheel` to a listener that is not passive, and `key` to keydown.
 */
export function createImageCropper(stage: () => HTMLElement | null, read: () => CropperRead, commit: (crop: ImageCrop) => void, onActive: (on: boolean) => void) {
  let latest: ImageCrop = centreCrop
  const pointers = new Map<number, { x: number; y: number }>()
  let tap: { id: number; x: number; y: number } | null = null

  const set = (next: ImageCrop) => {
    const { size, aspect, minZoom, maxZoom } = read()
    const clamped = clampCrop(next, size, aspect, minZoom, maxZoom)
    if (clamped.x === latest.x && clamped.y === latest.y && clamped.zoom === latest.zoom) return
    latest = clamped
    commit(clamped)
  }

  // Pixels on screen per unit of x and y, at a given zoom.
  const scale = (zoom: number) => {
    const rect = stage()?.getBoundingClientRect()
    const { size, aspect } = read()
    if (!rect || !size) return null
    const { fw, fh } = coverFraction(size, aspect)
    return { px: (rect.width * zoom) / fw, py: (rect.height * zoom) / fh, rect }
  }

  const pan = (dx: number, dy: number) => {
    const c = latest
    const s = scale(c.zoom)
    if (!s) return
    set({ ...c, x: c.x - dx / s.px, y: c.y - dy / s.py })
  }

  // Zooms so the point under (clientX, clientY) stays where it is. With no point, the frame's centre stays.
  const zoomTo = (zoom: number, clientX?: number, clientY?: number) => {
    const c = latest
    const { minZoom, maxZoom } = read()
    const next = Math.min(maxZoom, Math.max(minZoom, zoom))
    const a = scale(c.zoom)
    const b = scale(next)
    if (!a || !b) return set({ ...c, zoom: next })
    const ox = clientX === undefined ? 0 : clientX - (a.rect.left + a.rect.width / 2)
    const oy = clientY === undefined ? 0 : clientY - (a.rect.top + a.rect.height / 2)
    set({ zoom: next, x: c.x + ox / a.px - ox / b.px, y: c.y + oy / a.py - oy / b.py })
  }

  return {
    sync(crop: ImageCrop) {
      latest = crop
    },
    zoomTo,
    wheel(e: WheelEvent) {
      e.preventDefault()
      zoomTo(latest.zoom * Math.exp(-e.deltaY * WHEEL_ZOOM), e.clientX, e.clientY)
    },
    down(e: PointerLike) {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      tap = pointers.size === 0 ? { id: e.pointerId, x: e.clientX, y: e.clientY } : null
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      onActive(true)
    },
    move(e: PointerLike) {
      const prev = pointers.get(e.pointerId)
      if (!prev) return
      if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) >= TAP_SLOP) tap = null
      const others = [...pointers.entries()].filter(([id]) => id !== e.pointerId)
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (others.length === 0) return pan(e.clientX - prev.x, e.clientY - prev.y)
      // Two fingers: zoom by how far apart they moved, around the point between them, and pan with that point.
      const other = others[0][1]
      const before = Math.hypot(prev.x - other.x, prev.y - other.y)
      const after = Math.hypot(e.clientX - other.x, e.clientY - other.y)
      const mid = { x: (e.clientX + other.x) / 2, y: (e.clientY + other.y) / 2 }
      pan((e.clientX - prev.x) / 2, (e.clientY - prev.y) / 2)
      if (before > 0) zoomTo(latest.zoom * (after / before), mid.x, mid.y)
    },
    up(e: PointerLike) {
      pointers.delete(e.pointerId)
      if (pointers.size === 0) onActive(false)
      // A tap without a drag centres the frame on the tapped point, so one plain press can move the crop.
      if (tap?.id !== e.pointerId) return
      tap = null
      const rect = stage()?.getBoundingClientRect()
      if (e.type === 'pointerup' && rect) pan(rect.left + rect.width / 2 - e.clientX, rect.top + rect.height / 2 - e.clientY)
    },
    /** True when the key moved or zoomed the photo; the caller then prevents the default. */
    key(e: { key: string; shiftKey: boolean }) {
      const c = latest
      const step = (e.shiftKey ? KEY_PAN_BIG : KEY_PAN) / c.zoom
      const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
      const move = moves[e.key]
      if (move) set({ ...c, x: c.x - move[0] * step, y: c.y - move[1] * step })
      else if (e.key === '+' || e.key === '=') zoomTo(c.zoom * KEY_ZOOM)
      else if (e.key === '-' || e.key === '_') zoomTo(c.zoom / KEY_ZOOM)
      else return false
      return true
    },
  }
}
