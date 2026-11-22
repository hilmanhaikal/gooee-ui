'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { cx } from '../../internal/cx'
import { MinusIcon, PlusIcon } from '../../icons/icons'
import { BUTTON_ZOOM, centreCrop, clampCrop, createImageCropper, cropImageStyle, getCropArea, type CropArea, type CropSize, type ImageCrop } from '../../internal/motion/imageCropper'
import { ratioNumber } from '../../internal/ratio'
import { useControllable } from '../../internal/useControllable'
import { IconButton } from '../IconButton'
import { Slider } from '../Slider'
import styles from './ImageCropper.module.css'

export type { CropArea, ImageCrop }
export { getCropArea }

export type ImageCropperLabels = {
  /** Visible name of the zoom slider. */
  zoom: string
  /** Name of the zoom out button. */
  zoomOut: string
  /** Name of the zoom in button. */
  zoomIn: string
  /** How to use the frame with the keyboard, read when it gets focus. */
  help: string
}

export type ImageCropperProps = {
  /** The photo to crop. */
  src: string
  /** A tiny image, usually a data URL, shown blurred in the frame until the photo loads. */
  placeholder?: string
  /** Accessible name of the crop frame, such as "Crop your profile photo". */
  label: string
  /** Width over height of the frame, such as 1, 4 / 3 or "16 / 9". */
  ratio?: number | string
  /** Shows a round mask, for avatars. Use it with ratio 1. */
  round?: boolean
  /** Crop, when you control it. */
  value?: ImageCrop
  /** Starting crop when you do not control it. */
  defaultValue?: ImageCrop
  /** Called with the new crop on every move and zoom. */
  onValueChange?: (crop: ImageCrop) => void
  /** Called with the crop in the photo's pixels, once it loads and after every change. Cut it with a canvas. */
  onCropAreaChange?: (area: CropArea) => void
  /** Least zoom. 1 means the photo just covers the frame. Below 1, the photo sits in the middle on the sides where it is smaller than the frame. */
  minZoom?: number
  /** Most zoom. */
  maxZoom?: number
  /** Passed to the img, such as "anonymous" when you will read the cut pixels from a canvas. */
  crossOrigin?: '' | 'anonymous' | 'use-credentials'
  /** Words for other languages. */
  labels?: Partial<ImageCropperLabels>
  /** Extra class for the root. */
  className?: string
}

const defaultLabels: ImageCropperLabels = {
  zoom: 'Zoom',
  zoomOut: 'Zoom out',
  zoomIn: 'Zoom in',
  help: 'Use the arrow keys to move the photo, and plus and minus to zoom.',
}

export function ImageCropper({
  src,
  placeholder,
  label,
  ratio = 1,
  round = false,
  value: valueProp,
  defaultValue = centreCrop,
  onValueChange,
  onCropAreaChange,
  minZoom = 1,
  maxZoom = 3,
  crossOrigin,
  labels: labelsProp,
  className,
}: ImageCropperProps) {
  const labels = { ...defaultLabels, ...labelsProp }
  const helpId = useId()
  const stageRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [size, setSize] = useState<CropSize | null>(null)
  const [lastSrc, setLastSrc] = useState(src)
  const [raw, setRaw] = useControllable(valueProp, defaultValue, onValueChange)
  const [active, setActive] = useState(false)
  if (src !== lastSrc) {
    setLastSrc(src)
    setSize(null)
  }
  const aspect = ratioNumber(ratio)
  const crop = clampCrop(raw, size, aspect, minZoom, maxZoom)
  const areaCb = useRef(onCropAreaChange)
  areaCb.current = onCropAreaChange
  const latest = useRef({ size, aspect, minZoom, maxZoom, setRaw })
  latest.current = { size, aspect, minZoom, maxZoom, setRaw }
  const core = useRef<ReturnType<typeof createImageCropper>>(null)
  // Drag, pinch, wheel, tap and keys (motion/imageCropper.ts).
  core.current ??= createImageCropper(
    () => stageRef.current,
    () => latest.current,
    (c) => latest.current.setRaw(c),
    setActive,
  )
  const cropper = core.current
  cropper.sync(crop)

  // A cached or server-rendered photo can finish loading before React listens for onLoad.
  useEffect(() => {
    const img = imgRef.current
    if (img?.complete && img.naturalWidth) setSize({ width: img.naturalWidth, height: img.naturalHeight })
  }, [src])

  const areaKey = size ? JSON.stringify(getCropArea(crop, size, aspect)) : ''
  useEffect(() => {
    if (areaKey) areaCb.current?.(JSON.parse(areaKey))
  }, [areaKey])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    // React adds wheel listeners as passive, and a passive listener cannot stop the page from scrolling.
    stage.addEventListener('wheel', cropper.wheel, { passive: false })
    return () => stage.removeEventListener('wheel', cropper.wheel)
  }, [cropper])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (cropper.key(e)) e.preventDefault()
  }

  const imgStyle = cropImageStyle(crop, size, aspect)

  return (
    <div data-slot="image-cropper" className={cx(styles.root, className)}>
      <div
        ref={stageRef}
        data-slot="image-cropper-stage"
        className={styles.stage}
        style={{ aspectRatio: aspect }}
        tabIndex={0}
        role="group"
        aria-roledescription="crop frame"
        aria-label={label}
        aria-describedby={helpId}
        data-round={round || undefined}
        data-active={active || undefined}
        data-ready={size ? true : undefined}
        onPointerDown={cropper.down}
        onPointerMove={cropper.move}
        onPointerUp={cropper.up}
        onPointerCancel={cropper.up}
        onKeyDown={onKeyDown}
      >
        {placeholder && <img data-slot="image-cropper-placeholder" className={styles.placeholder} src={placeholder} alt="" aria-hidden="true" draggable={false} />}
        <img
          key={src}
          ref={imgRef}
          data-slot="image-cropper-img"
          className={styles.img}
          src={src}
          alt=""
          crossOrigin={crossOrigin}
          draggable={false}
          style={imgStyle}
          onLoad={(e) => setSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
        />
        <span data-slot="image-cropper-guides" className={styles.guides} aria-hidden="true" />
      </div>
      <p id={helpId} data-slot="image-cropper-help" className={styles.srOnly}>
        {labels.help}
      </p>
      <div data-slot="image-cropper-zoom" className={styles.zoom}>
        <IconButton label={labels.zoomOut} icon={<MinusIcon />} variant="secondary" onClick={() => cropper.zoomTo(crop.zoom / BUTTON_ZOOM)} />
        <Slider
          className={styles.slider}
          label={labels.zoom}
          min={minZoom}
          max={maxZoom}
          step={0.01}
          value={crop.zoom}
          onValueChange={(z) => cropper.zoomTo(z)}
          formatValue={(z) => `${Math.round(z * 100)}%`}
        />
        <IconButton label={labels.zoomIn} icon={<PlusIcon />} variant="secondary" onClick={() => cropper.zoomTo(crop.zoom * BUTTON_ZOOM)} />
      </div>
    </div>
  )
}
