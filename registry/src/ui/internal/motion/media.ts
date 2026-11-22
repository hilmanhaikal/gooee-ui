// Gooee UI, MIT licence. https://gooee.dev
// The media players' DOM logic, shared by VideoPlayer, AudioPlayer and their speed menu, in React and Vue.

export type MediaState = {
  playing: boolean
  time: number
  duration: number
  /** End of the last buffered range, in seconds. */
  buffered: number
  volume: number
  muted: boolean
  rate: number
}

export const EMPTY_MEDIA: MediaState = { playing: false, time: 0, duration: 0, buffered: 0, volume: 1, muted: false, rate: 1 }

const EVENTS = ['play', 'pause', 'ended', 'timeupdate', 'durationchange', 'loadedmetadata', 'volumechange', 'ratechange', 'progress', 'seeked', 'emptied']

/** Calls `onState` with the media element's state on every change, and every frame while it plays. Returns a stop function. */
export function watchMedia(el: HTMLMediaElement, onState: (state: MediaState) => void) {
  let frame = 0
  const read = () => {
    const b = el.buffered
    onState({
      playing: !el.paused && !el.ended,
      time: el.currentTime,
      duration: Number.isFinite(el.duration) ? el.duration : 0,
      buffered: b.length ? b.end(b.length - 1) : 0,
      volume: el.volume,
      muted: el.muted,
      rate: el.playbackRate,
    })
  }
  // timeupdate fires about 4 times a second; a frame loop keeps the seek bar smooth while playing.
  const loop = () => {
    read()
    frame = requestAnimationFrame(loop)
  }
  const onPlay = () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(loop)
  }
  const onStop = () => cancelAnimationFrame(frame)
  EVENTS.forEach((ev) => el.addEventListener(ev, read))
  el.addEventListener('playing', onPlay)
  el.addEventListener('pause', onStop)
  el.addEventListener('ended', onStop)
  read()
  if (!el.paused && !el.ended) frame = requestAnimationFrame(loop)
  return () => {
    cancelAnimationFrame(frame)
    EVENTS.forEach((ev) => el.removeEventListener(ev, read))
    el.removeEventListener('playing', onPlay)
    el.removeEventListener('pause', onStop)
    el.removeEventListener('ended', onStop)
  }
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

export function togglePlay(el: HTMLMediaElement) {
  // play() rejects when the browser blocks it or the source fails; the paused state already shows that.
  if (el.paused || el.ended) el.play().catch(() => {})
  else el.pause()
}

export function seekBy(el: HTMLMediaElement, delta: number) {
  const end = Number.isFinite(el.duration) ? el.duration : el.currentTime + delta
  el.currentTime = Math.min(Math.max(0, el.currentTime + delta), end)
}

export function readMs(el: Element, name: string, fallback: number): number {
  const raw = getComputedStyle(el).getPropertyValue(name).trim()
  if (!raw) return fallback
  const n = parseFloat(raw)
  return raw.endsWith('ms') ? n : n * 1000
}

/** The mute button: turns the sound off, or back on at half volume when it was at 0. */
export function toggleMute(el: HTMLMediaElement, silent: boolean) {
  el.muted = !silent
  if (!el.muted && el.volume === 0) el.volume = 0.5
}

/** What a key handler needs: native and React keyboard events both have these. */
export type KeyLike = Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'defaultPrevented' | 'preventDefault' | 'stopPropagation'> & { target: EventTarget | null }

export type MediaKeyResult = 'play' | 'seek' | 'volume' | 'mute' | 'fullscreen' | 'captions' | null

/**
 * The player shortcuts: Space and K play or pause, J and L jump 10 seconds, Left and Right 5 seconds,
 * Up and Down change volume, M mutes, F goes full screen, C toggles captions.
 * Keys a focused control already uses (Space on a button, arrows on a slider) are left to it.
 */
export function handleMediaKey(e: KeyLike, el: HTMLMediaElement, extra: { fullscreen?: () => void; captions?: () => void } = {}): MediaKeyResult {
  if (e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return null
  const target = e.target as HTMLElement
  if (target.closest('[role="menu"]')) return null
  const onButton = target.tagName === 'BUTTON'
  const onRange = target instanceof HTMLInputElement && target.type === 'range'
  let result: MediaKeyResult = null
  switch (e.key) {
    case ' ':
      if (onButton) return null
      togglePlay(el)
      result = 'play'
      break
    case 'k':
    case 'K':
      togglePlay(el)
      result = 'play'
      break
    case 'j':
    case 'J':
      seekBy(el, -10)
      result = 'seek'
      break
    case 'l':
    case 'L':
      seekBy(el, 10)
      result = 'seek'
      break
    case 'ArrowLeft':
    case 'ArrowRight':
      if (onRange) return null
      seekBy(el, e.key === 'ArrowLeft' ? -5 : 5)
      result = 'seek'
      break
    case 'ArrowUp':
    case 'ArrowDown':
      if (onRange) return null
      el.volume = Math.min(1, Math.max(0, Math.round((el.volume + (e.key === 'ArrowUp' ? 0.1 : -0.1)) * 10) / 10))
      if (el.volume > 0) el.muted = false
      result = 'volume'
      break
    case 'm':
    case 'M':
      el.muted = !el.muted
      result = 'mute'
      break
    case 'f':
    case 'F':
      if (!extra.fullscreen) return null
      extra.fullscreen()
      result = 'fullscreen'
      break
    case 'c':
    case 'C':
      if (!extra.captions) return null
      extra.captions()
      result = 'captions'
      break
    default:
      return null
  }
  e.preventDefault()
  return result
}

/** Keys for a seek slider: arrows 5 seconds, Page Up and Down 10%, Home and End. */
export function handleSeekKey(e: KeyLike, el: HTMLMediaElement): boolean {
  const d = Number.isFinite(el.duration) ? el.duration : 0
  if (!d) return false
  let next: number
  switch (e.key) {
    case 'ArrowLeft':
    case 'ArrowDown':
      next = el.currentTime - 5
      break
    case 'ArrowRight':
    case 'ArrowUp':
      next = el.currentTime + 5
      break
    case 'PageDown':
      next = el.currentTime - d / 10
      break
    case 'PageUp':
      next = el.currentTime + d / 10
      break
    case 'Home':
      next = 0
      break
    case 'End':
      next = d
      break
    default:
      return false
  }
  e.preventDefault()
  e.stopPropagation()
  el.currentTime = Math.min(Math.max(0, next), d)
  return true
}

export type AnnounceLabels = { playing: string; paused: string; muted: string; volumeValue: string; seekValue: string; captionsOn?: string; captionsOff?: string }

/** What a shortcut's result is read as, or '' for nothing. */
export function announcement(result: MediaKeyResult, el: HTMLMediaElement, labels: AnnounceLabels, captionsNow = false) {
  const volume = labels.volumeValue.replace('{value}', String(Math.round(el.volume * 100)))
  if (result === 'play') return el.paused ? labels.paused : labels.playing
  if (result === 'mute') return el.muted ? labels.muted : volume
  if (result === 'volume') return volume
  if (result === 'seek') return labels.seekValue.replace('{current}', formatTime(el.currentTime)).replace('{duration}', formatTime(el.duration))
  if (result === 'captions') return (captionsNow ? labels.captionsOn : labels.captionsOff) ?? ''
  return ''
}

/** A live region reads a change only, so the same words twice get a trailing space. */
export const nextStatus = (prev: string, text: string) => (prev === text ? `${text} ` : text)

/** The speed menu's keys: the new active item, 'close' for Esc, 'tab' for Tab, or null for other keys. */
export function speedMenuKey(key: string, active: number, count: number): number | 'close' | 'tab' | null {
  const last = count - 1
  if (key === 'ArrowDown') return active === last ? 0 : active + 1
  if (key === 'ArrowUp') return active === 0 ? last : active - 1
  if (key === 'Home') return 0
  if (key === 'End') return last
  if (key === 'Escape') return 'close'
  if (key === 'Tab') return 'tab'
  return null
}

const MAX_BARS = 96

/** A waveform's bars: long peak lists are cut down to MAX_BARS, each the loudest of its stretch. */
export function reducePeaks(peaks: number[]): number[] {
  if (peaks.length <= MAX_BARS) return peaks
  const size = peaks.length / MAX_BARS
  return Array.from({ length: MAX_BARS }, (_, i) => {
    let max = 0
    for (let k = Math.floor(i * size); k < Math.floor((i + 1) * size); k++) max = Math.max(max, peaks[k] ?? 0)
    return max
  })
}

type VideoWithWebkit = HTMLVideoElement & { webkitEnterFullscreen?: () => void }

/** Whether this browser can show the video full screen and picture in picture. */
export function videoSupport(v: HTMLVideoElement) {
  return {
    fullscreen: Boolean(document.fullscreenEnabled || (v as VideoWithWebkit).webkitEnterFullscreen),
    pip: Boolean(document.pictureInPictureEnabled && !v.disablePictureInPicture),
  }
}

export function toggleFullscreen(root: HTMLElement, v: HTMLVideoElement) {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  else if (root.requestFullscreen) root.requestFullscreen().catch(() => {})
  else (v as VideoWithWebkit).webkitEnterFullscreen?.()
}

export function togglePip(v: HTMLVideoElement) {
  if (document.pictureInPictureElement === v) document.exitPictureInPicture().catch(() => {})
  else v.requestPictureInPicture().catch(() => {})
}

/**
 * Listens for the video's load trouble, full screen and picture in picture. `onFailed` and `onBuffering`
 * get true or false; `onFullscreen` says whether `root` is full screen; `onPip` whether the video floats.
 * Returns a stop function.
 */
export function watchVideo(
  v: HTMLVideoElement,
  root: () => HTMLElement | null,
  on: { failed: (on: boolean) => void; buffering: (on: boolean) => void; fullscreen: (on: boolean) => void; pip: (on: boolean) => void },
) {
  const onError = () => {
    on.failed(true)
    on.buffering(false)
  }
  const onWait = () => on.buffering(true)
  const onReady = () => on.buffering(false)
  const onFs = () => on.fullscreen(document.fullscreenElement === root())
  const onPipIn = () => on.pip(true)
  const onPipOut = () => on.pip(false)
  // A failed <source> fires its error on the source, and errors do not bubble: capture hears both.
  v.addEventListener('error', onError, true)
  v.addEventListener('waiting', onWait)
  v.addEventListener('playing', onReady)
  v.addEventListener('canplay', onReady)
  document.addEventListener('fullscreenchange', onFs)
  v.addEventListener('enterpictureinpicture', onPipIn)
  v.addEventListener('leavepictureinpicture', onPipOut)
  return () => {
    v.removeEventListener('error', onError, true)
    v.removeEventListener('waiting', onWait)
    v.removeEventListener('playing', onReady)
    v.removeEventListener('canplay', onReady)
    document.removeEventListener('fullscreenchange', onFs)
    v.removeEventListener('enterpictureinpicture', onPipIn)
    v.removeEventListener('leavepictureinpicture', onPipOut)
  }
}

/**
 * Shows the caption track at `index` when `on`, and calls `onLines` with its words as they change. The
 * browser keeps the timing; the player draws the words, so they sit above its own controls. Returns a stop function.
 */
export function watchCues(v: HTMLVideoElement, on: boolean, index: number, onLines: (lines: string[]) => void) {
  const all = Array.from(v.textTracks)
  all.forEach((t, i) => {
    t.mode = on && i === index ? 'hidden' : 'disabled'
  })
  const track = on ? all[index] : undefined
  if (!track) {
    onLines([])
    return () => {}
  }
  const read = () => onLines(Array.from(track.activeCues ?? []).flatMap((c) => ('text' in c ? String(c.text).replace(/<[^>]*>/g, '').split('\n') : [])))
  read()
  track.addEventListener('cuechange', read)
  return () => track.removeEventListener('cuechange', read)
}

/** The controls fade after --gooee-delay-video-player-idle while playing. `poke` wakes them; `onAwake` gets the state. */
export function createIdle(root: () => HTMLElement | null, onAwake: (awake: boolean) => void) {
  let timer = 0
  return {
    poke() {
      onAwake(true)
      window.clearTimeout(timer)
      const el = root()
      if (!el) return
      timer = window.setTimeout(() => onAwake(false), readMs(el, '--gooee-delay-video-player-idle', 2500))
    },
    stop: () => window.clearTimeout(timer),
  }
}

/** The retry button is about to go, so focus moves to the first control and is not dropped. */
export function focusFirstControl(root: HTMLElement | null, errorClass: string) {
  const controls = [...(root?.querySelectorAll('button') ?? [])]
  controls.find((b) => b.tabIndex >= 0 && !b.closest(`.${errorClass}`))?.focus()
}
