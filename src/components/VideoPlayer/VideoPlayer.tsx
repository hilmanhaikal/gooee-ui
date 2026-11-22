'use client'

import { useEffect, useId, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type PointerEvent } from 'react'
import { cx } from '../../internal/cx'
import {
  CaptionsIcon,
  ExitFullscreenIcon,
  FullscreenIcon,
  PauseIcon,
  PipIcon,
  PlayIcon,
  VolumeIcon,
  VolumeOffIcon,
} from '../../icons/icons'
import {
  announcement,
  createIdle,
  focusFirstControl,
  formatTime,
  handleMediaKey,
  handleSeekKey,
  nextStatus,
  toggleFullscreen as fullscreenToggle,
  toggleMute,
  togglePip as pipToggle,
  togglePlay,
  videoSupport,
  watchCues,
  watchVideo,
} from '../../internal/motion/media'
import { useMediaState } from './media'
import { Button } from '../Button'
import { Spinner } from '../Spinner'
import { SpeedMenu } from './SpeedMenu'
import styles from './VideoPlayer.module.css'

export type VideoSource = {
  src: string
  /** MIME type, such as "video/webm". The browser skips types it cannot play. */
  type?: string
}

export type VideoTrack = {
  /** WebVTT file URL. */
  src: string
  /** Language code, such as "en". */
  srclang: string
  /** Name of the track, such as "English". */
  label: string
  kind?: 'captions' | 'subtitles'
  /** Turns this track on at start. */
  default?: boolean
}

export type VideoPlayerLabels = {
  /** Name of the player region. {title} is filled in. */
  player: string
  play: string
  pause: string
  mute: string
  unmute: string
  volume: string
  seek: string
  /** Spoken value of the seek bar. {current} and {duration} are filled in. */
  seekValue: string
  captions: string
  speed: string
  /** Visible speed. {rate} is filled in. */
  rate: string
  fullscreen: string
  exitFullscreen: string
  pip: string
  /** Spoken after a shortcut changes something. */
  playing: string
  paused: string
  muted: string
  /** {value} is filled in. */
  volumeValue: string
  captionsOn: string
  captionsOff: string
  /** Read when the player gets focus. */
  shortcuts: string
  /** Shown over the player when the video cannot play. */
  error: string
  /** Button that loads the video again after an error. */
  retry: string
  /** Spoken while the video waits for more data. */
  buffering: string
}

const defaultLabels: VideoPlayerLabels = {
  player: 'Video: {title}',
  play: 'Play',
  pause: 'Pause',
  mute: 'Mute',
  unmute: 'Unmute',
  volume: 'Volume',
  seek: 'Seek',
  seekValue: '{current} of {duration}',
  captions: 'Captions',
  speed: 'Playback speed',
  rate: '{rate}×',
  fullscreen: 'Full screen',
  exitFullscreen: 'Exit full screen',
  pip: 'Picture in picture',
  playing: 'Playing',
  paused: 'Paused',
  muted: 'Muted',
  volumeValue: 'Volume {value}%',
  captionsOn: 'Captions on',
  captionsOff: 'Captions off',
  shortcuts: 'Shortcuts. Space or K plays and pauses. J and L jump 10 seconds. Left and Right jump 5 seconds. Up and Down change the volume. M mutes. C turns captions on or off. F opens full screen.',
  error: 'This video could not be played.',
  retry: 'Try again',
  buffering: 'Buffering',
}

export type VideoPlayerProps = {
  /** Video URL. Use sources instead to offer more than one format. */
  src?: string
  /** Several formats of the same video. The browser plays the first it supports. */
  sources?: VideoSource[]
  /** Name of the video, spoken as the player's name. */
  title: string
  /** Image shown before the video plays. */
  poster?: string
  /** A tiny image, usually a data URL, shown blurred until the poster loads or the video starts. Needs poster. */
  posterPlaceholder?: string
  /** Caption or subtitle files. A captions button shows when there is at least one. */
  tracks?: VideoTrack[]
  /** Width over height of the frame, such as 16 / 9 or "16 / 9". */
  ratio?: number | string
  /** Speeds offered in the speed menu. */
  speeds?: number[]
  /** Starts with the sound off. */
  defaultMuted?: boolean
  /** Starts again from the beginning at the end. */
  loop?: boolean
  /** Text for buttons and screen readers, so you can translate it. */
  labels?: Partial<VideoPlayerLabels>
  /** Extra class for the root element. */
  className?: string
}

export function VideoPlayer({
  src,
  sources,
  title,
  poster,
  posterPlaceholder,
  tracks = [],
  ratio = '16 / 9',
  speeds = [0.5, 0.75, 1, 1.25, 1.5, 2],
  defaultMuted = false,
  loop = false,
  labels: labelsProp,
  className,
}: VideoPlayerProps) {
  const labels = { ...defaultLabels, ...labelsProp }
  const hintId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  // A string key, so an inline sources array does not count as new on every render.
  const sourceKey = sources ? sources.map((x) => `${x.src} ${x.type ?? ''}`).join('\n') : src
  const s = useMediaState(videoRef, sourceKey)
  const loadedKey = useRef(sourceKey)
  const [awake, setAwake] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [keyboardInside, setKeyboardInside] = useState(false)
  const [captions, setCaptions] = useState(tracks.some((t) => t.default))
  const [fullscreen, setFullscreen] = useState(false)
  const [pip, setPip] = useState(false)
  const [support, setSupport] = useState({ fullscreen: false, pip: false })
  const [status, setStatus] = useState('')
  const [failed, setFailed] = useState(false)
  const [buffering, setBuffering] = useState(false)
  const idle = useRef<ReturnType<typeof createIdle>>(null)
  idle.current ??= createIdle(() => rootRef.current, setAwake)
  const { poke } = idle.current
  const touchWake = useRef(false)
  const started = s.playing || s.time > 0
  const showControls = !s.playing || awake || menuOpen || keyboardInside
  const [posterLoaded, setPosterLoaded] = useState<string>()

  useEffect(() => {
    if (!poster || !posterPlaceholder) return
    const img = new Image()
    img.onload = img.onerror = () => setPosterLoaded(poster)
    img.src = poster
    return () => {
      img.onload = img.onerror = null
    }
  }, [poster, posterPlaceholder])

  useEffect(() => {
    if (s.playing) poke()
    else {
      idle.current?.stop()
      setAwake(true)
    }
  }, [s.playing, poke])

  useEffect(() => () => idle.current?.stop(), [])

  // The browser ignores new <source> children until load() runs. A src attribute change loads by itself.
  useEffect(() => {
    if (loadedKey.current === sourceKey) return
    loadedKey.current = sourceKey
    if (sources) videoRef.current?.load()
  }, [sourceKey, sources])

  useEffect(() => {
    setFailed(false)
    setBuffering(false)
  }, [sourceKey])

  const retry = () => {
    focusFirstControl(rootRef.current, styles.error)
    setFailed(false)
    videoRef.current?.load()
  }

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = defaultMuted
    setSupport(videoSupport(v))
    return watchVideo(v, () => rootRef.current, { failed: setFailed, buffering: setBuffering, fullscreen: setFullscreen, pip: setPip })
  }, [])

  const captionIndex = Math.max(0, tracks.findIndex((t) => t.default))
  const [cueLines, setCueLines] = useState<string[]>([])
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    return watchCues(v, captions, captionIndex, setCueLines)
  }, [captions, captionIndex, tracks.length])

  const toggleFullscreen = () => {
    if (rootRef.current && videoRef.current) fullscreenToggle(rootRef.current, videoRef.current)
  }

  const togglePip = () => {
    if (videoRef.current) pipToggle(videoRef.current)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const v = videoRef.current
    if (!v) return
    const next = !captions
    const result = handleMediaKey(e, v, {
      fullscreen: support.fullscreen ? toggleFullscreen : undefined,
      captions: tracks.length ? () => setCaptions(next) : undefined,
    })
    if (!result) return
    poke()
    const text = announcement(result, v, labels, next)
    if (text) setStatus((prev) => nextStatus(prev, text))
  }

  const onFocusIn = (e: FocusEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).matches(':focus-visible')) setKeyboardInside(true)
  }
  const onFocusOut = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setKeyboardInside(false)
  }

  const onVideoPointerDown = (e: PointerEvent<HTMLVideoElement>) => {
    touchWake.current = e.pointerType !== 'mouse' && !showControls
  }
  const onVideoClick = () => {
    const v = videoRef.current
    if (!v) return
    if (!touchWake.current) togglePlay(v)
    touchWake.current = false
    poke()
  }

  const video = (fn: (v: HTMLVideoElement) => void) => {
    const v = videoRef.current
    if (v) fn(v)
  }
  const pct = s.duration ? s.time / s.duration : 0
  const buffered = s.duration ? Math.min(1, s.buffered / s.duration) : 0
  const volume = s.muted ? 0 : s.volume

  return (
    <div
      ref={rootRef}
      className={cx(styles.root, className)}
      data-slot="video-player"
      style={{ ['--ratio' as string]: ratio } as CSSProperties}
      role="region"
      aria-label={labels.player.replace('{title}', title)}
      aria-describedby={hintId}
      tabIndex={0}
      data-idle={!showControls || undefined}
      data-fullscreen={fullscreen || undefined}
      onKeyDown={onKeyDown}
      onPointerMove={(e) => e.pointerType === 'mouse' && poke()}
      onPointerLeave={() => s.playing && setAwake(false)}
    >
      {poster && posterPlaceholder && (
        <img
          className={styles.posterPlaceholder}
          data-slot="video-player-poster-placeholder"
          data-status={posterLoaded === poster || started ? 'loaded' : 'loading'}
          src={posterPlaceholder}
          alt=""
          aria-hidden="true"
          draggable={false}
        />
      )}
      <video
        ref={videoRef}
        className={styles.video}
        data-slot="video-player-video"
        src={sources ? undefined : src}
        poster={poster}
        preload="metadata"
        playsInline
        loop={loop}
        onPointerDown={onVideoPointerDown}
        onClick={onVideoClick}
        onDoubleClick={() => support.fullscreen && toggleFullscreen()}
      >
        {sources?.map((x) => <source key={x.src} src={x.src} type={x.type} />)}
        {tracks.map((t) => (
          <track key={t.src} src={t.src} srcLang={t.srclang} label={t.label} kind={t.kind ?? 'captions'} />
        ))}
      </video>

      {cueLines.length > 0 && (
        <div className={styles.captions} data-slot="video-player-captions" data-raised={showControls || undefined} aria-hidden="true">
          {cueLines.map((line, i) => (
            <span key={i} className={styles.cue} data-slot="video-player-cue">
              {line}
            </span>
          ))}
        </div>
      )}

      {buffering && !failed && (
        <span className={styles.buffering} data-slot="video-player-buffering">
          <Spinner size="lg" label={labels.buffering} />
        </span>
      )}

      {failed && (
        <div className={styles.error} data-slot="video-player-error" role="alert">
          <p className={styles.errorText} data-slot="video-player-error-text">{labels.error}</p>
          <Button variant="secondary" size="sm" onClick={retry}>
            {labels.retry}
          </Button>
        </div>
      )}

      {!started && !failed && (
        <button type="button" className={styles.bigPlay} data-slot="video-player-start" aria-hidden="true" tabIndex={-1} onClick={() => video(togglePlay)}>
          <PlayIcon />
        </button>
      )}

      <div className={styles.controls} data-slot="video-player-controls" data-hidden={!showControls || undefined} onFocus={onFocusIn} onBlur={onFocusOut}>
        <div className={cx(styles.range, styles.seek)} data-slot="video-player-seek" style={{ ['--p' as string]: pct, ['--b' as string]: buffered } as CSSProperties}>
          <input
            type="range"
            className={styles.rangeInput}
            data-slot="video-player-range-input"
            aria-label={labels.seek}
            aria-valuetext={labels.seekValue.replace('{current}', formatTime(s.time)).replace('{duration}', formatTime(s.duration))}
            min={0}
            max={s.duration || 0}
            step="any"
            value={Math.min(s.time, s.duration || 0)}
            disabled={!s.duration}
            onChange={(e) => video((v) => (v.currentTime = Number(e.target.value)))}
            onKeyDown={(e) => video((v) => handleSeekKey(e, v) && poke())}
          />
          <span className={styles.track} data-slot="video-player-track" aria-hidden="true">
            <span className={styles.buffered} data-slot="video-player-buffered" />
            <span className={styles.fill} data-slot="video-player-range" />
            <span className={styles.thumb} data-slot="video-player-thumb" />
          </span>
        </div>

        <div className={styles.bar} data-slot="video-player-bar">
          <button type="button" className={styles.btn} data-slot="video-player-button" aria-label={s.playing ? labels.pause : labels.play} onClick={() => video(togglePlay)}>
            {s.playing ? <PauseIcon /> : <PlayIcon />}
          </button>

          <div className={styles.volume} data-slot="video-player-volume">
            <button
              type="button"
              className={styles.btn} data-slot="video-player-button"
              aria-label={s.muted || s.volume === 0 ? labels.unmute : labels.mute}
              onClick={() =>
                video((v) => toggleMute(v, s.muted || s.volume === 0))
              }
            >
              {s.muted || s.volume === 0 ? <VolumeOffIcon /> : <VolumeIcon />}
            </button>
            <div className={cx(styles.range, styles.volumeRange)} data-slot="video-player-volume-range" style={{ ['--p' as string]: volume } as CSSProperties}>
              <input
                type="range"
                className={styles.rangeInput}
                data-slot="video-player-range-input"
                aria-label={labels.volume}
                aria-valuetext={labels.volumeValue.replace('{value}', String(Math.round(volume * 100)))}
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) =>
                  video((v) => {
                    v.volume = Number(e.target.value)
                    v.muted = v.volume === 0
                  })
                }
              />
              <span className={styles.track} data-slot="video-player-track" aria-hidden="true">
                <span className={styles.fill} data-slot="video-player-range" />
                <span className={styles.thumb} data-slot="video-player-thumb" />
              </span>
            </div>
          </div>

          <span className={styles.time} data-slot="video-player-time" aria-hidden="true">
            {formatTime(s.time)} / {formatTime(s.duration)}
          </span>

          <span className={styles.spacer} />

          {tracks.length > 0 && (
            <button type="button" className={styles.btn} data-slot="video-player-button" aria-label={labels.captions} aria-pressed={captions} data-state={captions ? 'on' : 'off'} onClick={() => setCaptions(!captions)}>
              <CaptionsIcon />
            </button>
          )}
          <SpeedMenu
            rates={speeds}
            rate={s.rate}
            onRate={(r) => video((v) => (v.playbackRate = r))}
            label={labels.speed}
            format={labels.rate}
            tone="scrim"
            onOpenChange={setMenuOpen}
          />
          {support.pip && (
            <button type="button" className={cx(styles.btn, styles.pip)} data-slot="video-player-button" aria-label={labels.pip} aria-pressed={pip} data-state={pip ? 'on' : 'off'} onClick={togglePip}>
              <PipIcon />
            </button>
          )}
          {support.fullscreen && (
            <button type="button" className={styles.btn} data-slot="video-player-button" aria-label={fullscreen ? labels.exitFullscreen : labels.fullscreen} onClick={toggleFullscreen}>
              {fullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
            </button>
          )}
        </div>
      </div>

      <span id={hintId} className={styles.sr}>{labels.shortcuts}</span>
      <span className={styles.sr} aria-live="polite">{status}</span>
    </div>
  )
}
