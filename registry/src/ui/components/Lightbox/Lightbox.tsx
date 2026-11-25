// Gooee UI, MIT licence. https://gooee.dev
'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from '../../internal/cx'
import { useFocusTrap } from '../../internal/focus'
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from '../../icons/icons'
import { useDismiss, useScrollLock } from '../../internal/layers'
import { createLightbox, preloadAround } from '../../internal/motion/lightbox'
import { Portal } from '../../internal/Portal'
import { Image } from '../Image'
import styles from './Lightbox.module.css'

export type LightboxImage = {
  src: string
  /** Required. Read out as the name of each picture. */
  alt: string
  /** Smaller file for the gallery grid. Defaults to src. */
  thumb?: string
  /** A tiny image, usually a data URL, shown blurred until the photo loads. */
  placeholder?: string
  caption?: ReactNode
}

export type LightboxLabels = {
  viewer: string
  close: string
  prev: string
  next: string
  /** {n} and {total} are filled in. */
  counter: string
  open: string
}

const defaultLabels: LightboxLabels = {
  viewer: 'Image viewer',
  close: 'Close',
  prev: 'Previous image',
  next: 'Next image',
  counter: '{n} of {total}',
  open: 'Open {alt}',
}

export type LightboxProps = {
  /** All pictures the viewer can page through, in order. */
  images: LightboxImage[]
  /** The open image, or null when closed. */
  index: number | null
  /** Called when the open image changes, with the new index, or null on close. */
  onIndexChange: (index: number | null) => void
  /** Returns the thumbnail for an index, so the image zooms out of it and back into it. */
  getOrigin?: (index: number) => HTMLElement | null
  /** Text for screen readers and the counter, so you can translate it. */
  labels?: Partial<LightboxLabels>
}

export function Lightbox({ images, index, onIndexChange, getOrigin, labels: labelsProp }: LightboxProps) {
  const labels = { ...defaultLabels, ...labelsProp }
  const titleId = useId()
  const open = index !== null
  const [shown, setShown] = useState<number | null>(index)
  const [closing, setClosing] = useState(false)
  const [dir, setDir] = useState<'next' | 'prev' | undefined>(undefined)
  const rootRef = useRef<HTMLDivElement>(null)
  const scrimRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const zoomed = useRef(false)
  // Photos that have loaded, by src. A cached one skips its placeholder.
  const [loaded, setLoaded] = useState<Record<string, 'load' | 'cached'>>({})
  const markLoaded = (src: string, how: 'load' | 'cached') => setLoaded((l) => (l[src] ? l : { ...l, [src]: how }))
  const total = images.length
  // Moves read the latest index here (motion/lightbox.ts).
  const latest = useRef({ index, total, getOrigin, onIndexChange })
  latest.current = { index, total, getOrigin, onIndexChange }
  const core = useRef<ReturnType<typeof createLightbox>>(null)
  core.current ??= createLightbox(
    () => imgRef.current,
    () => scrimRef.current,
    () => latest.current,
    (n) => latest.current.onIndexChange(n),
  )
  const box = core.current
  useEffect(() => () => box.destroy(), [box])

  // Keeps the last image while the close animation runs
  if (open && (shown !== index || closing)) {
    if (shown !== null && index !== null && shown !== index) setDir(index > shown ? 'next' : 'prev')
    setShown(index)
    setClosing(false)
  } else if (!open && shown !== null && !closing) {
    setClosing(true)
  }

  const mounted = shown !== null
  useScrollLock(open)
  useFocusTrap(rootRef, open && mounted, { modal: true })
  useDismiss(open, [rootRef], () => onIndexChange(null), { outside: false })

  useLayoutEffect(() => {
    if (!open || zoomed.current) return
    zoomed.current = true
    setDir(undefined)
    box.zoomIn(index as number)
  }, [open])

  useEffect(() => {
    if (!closing || shown === null) return
    box.zoomOut(shown, () => {
      setShown(null)
      setClosing(false)
      zoomed.current = false
    })
  }, [closing])

  const shownSrc = shown === null ? undefined : images[shown]?.src
  useLayoutEffect(() => {
    const el = imgRef.current
    if (shownSrc && el?.complete && el.naturalWidth) markLoaded(shownSrc, 'cached')
  }, [shownSrc])

  useEffect(() => {
    if (shown === null) return
    preloadAround(shown, images.map((i) => i.src))
  }, [shown, total])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (box.key(e.key)) e.preventDefault()
  }

  if (!mounted || shown === null) return null
  const item = images[shown]
  if (!item) return null

  return (
    <Portal>
      <div
        ref={rootRef}
        role="dialog"
        aria-modal="true"
        aria-label={labels.viewer}
        aria-describedby={titleId}
        tabIndex={-1}
        data-slot="lightbox"
        className={styles.root}
        data-state={closing ? 'closed' : 'open'}
        onKeyDown={onKeyDown}
      >
        <div ref={scrimRef} data-slot="lightbox-overlay" className={styles.scrim} aria-hidden="true" />
        <div data-slot="lightbox-stage" className={styles.stage} onPointerDown={box.down} onPointerMove={box.move} onPointerUp={box.up} onPointerCancel={box.up}>
          {item.placeholder && loaded[item.src] !== 'cached' && (
            <img
              key={`placeholder-${shown}`}
              data-slot="lightbox-placeholder"
              className={styles.placeholder}
              data-status={loaded[item.src] ? 'loaded' : 'loading'}
              src={item.placeholder}
              alt=""
              aria-hidden="true"
              draggable={false}
            />
          )}
          <img
            key={shown}
            ref={imgRef}
            data-slot="lightbox-img"
            className={styles.img}
            data-dir={dir}
            src={item.src}
            alt={item.alt}
            draggable={false}
            onLoad={() => markLoaded(item.src, 'load')}
            onError={() => markLoaded(item.src, 'load')}
          />
        </div>
        <button type="button" data-slot="lightbox-close" className={cx(styles.btn, styles.close)} aria-label={labels.close} onClick={() => onIndexChange(null)}>
          <XIcon />
        </button>
        <div className={styles.bar}>
          {/* aria-disabled, not disabled: a disabled button drops focus to the body and the arrow keys stop working */}
          {total > 1 && (
            <button type="button" data-slot="lightbox-prev" className={cx(styles.btn, styles.prev)} aria-label={labels.prev} aria-disabled={shown === 0} onClick={() => box.go(shown - 1)}>
              <ChevronLeftIcon />
            </button>
          )}
          <div id={titleId} className={styles.info} aria-live="polite">
            {total > 1 && <span data-slot="lightbox-counter" className={styles.counter}>{labels.counter.replace('{n}', String(shown + 1)).replace('{total}', String(total))}</span>}
            <span data-slot="lightbox-caption" className={styles.caption}>{item.caption ?? item.alt}</span>
          </div>
          {total > 1 && (
            <button type="button" data-slot="lightbox-next" className={cx(styles.btn, styles.next)} aria-label={labels.next} aria-disabled={shown === total - 1} onClick={() => box.go(shown + 1)}>
              <ChevronRightIcon />
            </button>
          )}
        </div>
      </div>
    </Portal>
  )
}

export type LightboxGalleryProps = {
  /** Pictures shown as thumbnails and opened in the viewer. */
  images: LightboxImage[]
  /** Width over height of each thumbnail. */
  ratio?: number | string
  /** Text for screen readers and the counter, so you can translate it. */
  labels?: Partial<LightboxLabels>
  /** Extra class for the root element, the thumbnail grid. */
  className?: string
  /** Inline styles for the thumbnail grid. */
  style?: CSSProperties
}

/** A grid of thumbnails wired to a Lightbox. */
export function LightboxGallery({ images, ratio = 1, labels, className, style }: LightboxGalleryProps) {
  const [index, setIndex] = useState<number | null>(null)
  const thumbs = useRef<Array<HTMLButtonElement | null>>([])
  const l = { ...defaultLabels, ...labels }
  return (
    <>
      <ul data-slot="lightbox-gallery" className={cx(styles.grid, className)} style={style}>
        {images.map((img, i) => (
          <li key={img.src}>
            <button
              ref={(el) => {
                thumbs.current[i] = el
              }}
              type="button"
              data-slot="lightbox-gallery-thumb"
              className={styles.thumb}
              aria-label={l.open.replace('{alt}', img.alt)}
              onClick={() => setIndex(i)}
            >
              <Image src={img.thumb ?? img.src} alt="" ratio={ratio} placeholder={img.placeholder} />
            </button>
          </li>
        ))}
      </ul>
      <Lightbox images={images} index={index} onIndexChange={setIndex} getOrigin={(i) => thumbs.current[i]} labels={labels} />
    </>
  )
}
