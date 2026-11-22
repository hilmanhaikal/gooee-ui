// Gooee UI, MIT licence. https://gooee.dev
'use client'

import { useRef, useState, type ComponentPropsWithRef, type CSSProperties, type ReactNode } from 'react'
import { cx } from '../../internal/cx'
import { mergeRefs } from '../../internal/mergeRefs'
import { Button } from '../Button'
import styles from './Image.module.css'

export type ImageProps = Omit<ComponentPropsWithRef<'img'>, 'placeholder'> & {
  /** Required. Describe the picture, or pass "" when it is only decoration. */
  alt: string
  /** A tiny image (often a data URL) shown blurred while the real one loads. */
  placeholder?: string
  /** Width over height, such as 16 / 9 or "4 / 3". Reserves the space, so the page does not jump. */
  ratio?: number | string
  /** "cover" fills the box and crops, "contain" shows the whole image. */
  fit?: 'cover' | 'contain'
  /** Shown when the image fails. Defaults to an icon with the alt text. */
  fallback?: ReactNode
  /** Adds a "Try again" button to the fallback that loads the image again. */
  retry?: boolean
  /** Rounds the corners with the panel radius. */
  rounded?: boolean
  /** Text for the image's controls, so you can translate it. Missing keys use the English defaults. */
  labels?: Partial<ImageLabels>
}

export type ImageLabels = {
  /** Text of the retry button. */
  retry: string
}

const defaultLabels: ImageLabels = { retry: 'Try again' }

type State = 'loading' | 'loaded' | 'error'

export function Image({
  alt,
  placeholder,
  ratio,
  fit = 'cover',
  fallback,
  retry = false,
  rounded = true,
  src,
  className,
  style,
  ref,
  loading = 'lazy',
  decoding = 'async',
  onLoad,
  onError,
  labels: labelsProp,
  ...rest
}: ImageProps) {
  const labels = { ...defaultLabels, ...labelsProp }
  const [state, setState] = useState<State>(src ? 'loading' : 'error')
  const [lastSrc, setLastSrc] = useState(src)
  // An instant (cached) image skips the fade, so it never flickers on a revisit.
  const [instant, setInstant] = useState(false)
  const [attempt, setAttempt] = useState(0)
  if (src !== lastSrc) {
    setLastSrc(src)
    setState(src ? 'loading' : 'error')
    setInstant(false)
  }

  const rootRef = useRef<HTMLSpanElement>(null)
  const { width, height } = rest
  const aspect = ratio !== undefined ? String(ratio) : width && height ? `${width} / ${height}` : undefined
  const boxStyle: CSSProperties = { aspectRatio: aspect, ...style }

  const fallbackContent = fallback ?? (
    <>
      <svg viewBox="0 0 24 24" data-slot="image-fallback-icon" className={styles.fallbackIcon} aria-hidden="true" focusable="false">
        <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
        <circle cx="9" cy="10" r="1.75" />
        <path d="M20.5 15.5l-5-5-9 8.5" />
        <path d="M3 3l18 18" />
      </svg>
      {alt && <span data-slot="image-fallback-text" className={styles.fallbackText} aria-hidden="true">{alt}</span>}
    </>
  )

  return (
    <span ref={rootRef} data-slot="image" tabIndex={retry ? -1 : undefined} className={cx(styles.root, rounded && styles.rounded, aspect === undefined && styles.flow, className)} style={boxStyle} data-status={state} data-instant={instant || undefined}>
      {placeholder && state !== 'error' && <img data-slot="image-placeholder" className={styles.placeholder} src={placeholder} alt="" aria-hidden="true" />}
      {state !== 'error' && src && (
        <img
          {...rest}
          key={attempt}
          ref={mergeRefs(ref, (el: HTMLImageElement | null) => {
            if (el && el.complete && el.naturalWidth > 0 && state === 'loading') {
              setInstant(true)
              setState('loaded')
            }
          })}
          data-slot="image-img"
          className={styles.img}
          src={src}
          alt={alt}
          loading={loading}
          decoding={decoding}
          style={{ objectFit: fit }}
          onLoad={(e) => {
            setState('loaded')
            onLoad?.(e)
          }}
          onError={(e) => {
            setState('error')
            onError?.(e)
          }}
        />
      )}
      {(state === 'error' || !src) && (
        <span data-slot="image-fallback" className={styles.fallback} role={alt && !retry ? 'img' : undefined} aria-label={alt && !retry ? alt : undefined}>
          {retry ? (
            <span className={styles.fallbackBody} role={alt ? 'img' : undefined} aria-label={alt || undefined}>
              {fallbackContent}
            </span>
          ) : (
            fallbackContent
          )}
          {retry && src && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                // The button goes away while the photo loads, so focus moves to the box and is not dropped.
                rootRef.current?.focus()
                setState('loading')
                setAttempt((n) => n + 1)
              }}
            >
              {labels.retry}
            </Button>
          )}
        </span>
      )}
    </span>
  )
}
