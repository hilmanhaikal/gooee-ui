<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import {
  announcement,
  createIdle,
  EMPTY_MEDIA,
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
  watchMedia,
  watchVideo,
} from '../../internal/motion/media'
import { CaptionsIcon, ExitFullscreenIcon, FullscreenIcon, PauseIcon, PipIcon, PlayIcon, VolumeIcon, VolumeOffIcon } from '../../icons/vue'
import Button from '../Button/Button.vue'
import Spinner from '../Spinner/Spinner.vue'
import SpeedMenu from './SpeedMenu.vue'
import styles from './VideoPlayer.module.css'

// The Vue VideoPlayer: the same look (VideoPlayer.module.css), keys, captions and fading controls as the React one.

export type VideoSource = { src: string; type?: string }
export type VideoTrack = { src: string; srclang: string; label: string; kind?: 'captions' | 'subtitles'; default?: boolean }
export type VideoPlayerLabels = {
  player: string
  play: string
  pause: string
  mute: string
  unmute: string
  volume: string
  seek: string
  seekValue: string
  captions: string
  speed: string
  rate: string
  fullscreen: string
  exitFullscreen: string
  pip: string
  playing: string
  paused: string
  muted: string
  volumeValue: string
  captionsOn: string
  captionsOff: string
  shortcuts: string
  error: string
  retry: string
  buffering: string
}

const { src, sources, poster, posterPlaceholder, tracks = [], ratio = '16 / 9', speeds = [0.5, 0.75, 1, 1.25, 1.5, 2], defaultMuted = false, loop = false, labels } = defineProps<{
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
  /** Caption or subtitle files (WebVTT). A captions button shows when there is at least one. */
  tracks?: VideoTrack[]
  /** Width over height of the frame, such as 16 / 9 or "16 / 9". */
  ratio?: number | string
  /** Speeds offered in the speed menu. */
  speeds?: number[]
  /** Starts with the sound off. */
  defaultMuted?: boolean
  /** Starts again from the beginning at the end. */
  loop?: boolean
  /** Text for buttons and screen readers, so you can translate it. {title}, {current}, {duration}, {rate} and {value} are filled in. */
  labels?: Partial<VideoPlayerLabels>
}>()

const words = computed<VideoPlayerLabels>(() => ({
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
  ...labels,
}))

const hintId = useId()
const root = ref<HTMLElement | null>(null)
const video = ref<HTMLVideoElement | null>(null)
// A string key, so a new sources array with the same files does not count as new.
const sourceKey = computed(() => (sources ? sources.map((x) => `${x.src} ${x.type ?? ''}`).join('\n') : src))
const s = ref(EMPTY_MEDIA)
const awake = ref(true)
const menuOpen = ref(false)
const keyboardInside = ref(false)
const captions = ref(tracks.some((t) => t.default))
const fullscreen = ref(false)
const pip = ref(false)
const support = ref({ fullscreen: false, pip: false })
const status = ref('')
const failed = ref(false)
const buffering = ref(false)
const cueLines = ref<string[]>([])
let touchWake = false
const started = computed(() => s.value.playing || s.value.time > 0)
const showControls = computed(() => !s.value.playing || awake.value || menuOpen.value || keyboardInside.value)
const posterLoaded = ref<string>()
watch(
  () => [poster, posterPlaceholder],
  (_, __, onCleanup) => {
    if (typeof window === 'undefined' || !poster || !posterPlaceholder) return
    const img = new Image()
    const url = poster
    img.onload = img.onerror = () => (posterLoaded.value = url)
    img.src = url
    onCleanup(() => (img.onload = img.onerror = null))
  },
  { immediate: true },
)
const captionIndex = computed(() => Math.max(0, tracks.findIndex((t) => t.default)))

// The element's state, its load trouble, full screen and captions (motion/media.ts).
const idle = createIdle(() => root.value, (on) => (awake.value = on))
const stops: Record<string, () => void> = {}
const hold = (key: string, stop?: () => void) => {
  stops[key]?.()
  stops[key] = stop ?? (() => {})
}
watch([video, sourceKey], ([v]) => hold('media', v ? watchMedia(v, (next) => (s.value = next)) : undefined), { flush: 'post' })
watch(
  video,
  (v) => {
    if (!v) return hold('video')
    v.muted = defaultMuted
    support.value = videoSupport(v)
    hold(
      'video',
      watchVideo(v, () => root.value, {
        failed: (on) => (failed.value = on),
        buffering: (on) => (buffering.value = on),
        fullscreen: (on) => (fullscreen.value = on),
        pip: (on) => (pip.value = on),
      }),
    )
  },
  { flush: 'post' },
)
watch([video, captions, captionIndex, () => tracks.length], ([v]) => hold('cues', v ? watchCues(v, captions.value, captionIndex.value, (lines) => (cueLines.value = lines)) : undefined), {
  flush: 'post',
})
onBeforeUnmount(() => {
  Object.values(stops).forEach((stop) => stop())
  idle.stop()
})

watch(
  () => s.value.playing,
  (playing) => {
    if (playing) idle.poke()
    else {
      idle.stop()
      awake.value = true
    }
  },
)

// The browser ignores new <source> children until load() runs. A src attribute change loads by itself.
watch(
  sourceKey,
  () => {
    failed.value = false
    buffering.value = false
    if (sources) video.value?.load()
  },
  { flush: 'post' },
)

const retry = () => {
  focusFirstControl(root.value, styles.error)
  failed.value = false
  video.value?.load()
}
const toggleFullscreen = () => root.value && video.value && fullscreenToggle(root.value, video.value)
const togglePip = () => video.value && pipToggle(video.value)
const use = (fn: (v: HTMLVideoElement) => void) => video.value && fn(video.value)

const onKeydown = (e: KeyboardEvent) => {
  const v = video.value
  if (!v) return
  const next = !captions.value
  const result = handleMediaKey(e, v, {
    fullscreen: support.value.fullscreen ? toggleFullscreen : undefined,
    captions: tracks.length ? () => (captions.value = next) : undefined,
  })
  if (!result) return
  idle.poke()
  const text = announcement(result, v, words.value, next)
  if (text) status.value = nextStatus(status.value, text)
}
const onFocusIn = (e: FocusEvent) => {
  if ((e.target as HTMLElement).matches(':focus-visible')) keyboardInside.value = true
}
const onFocusOut = (e: FocusEvent) => {
  if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) keyboardInside.value = false
}
const onVideoPointerDown = (e: PointerEvent) => {
  touchWake = e.pointerType !== 'mouse' && !showControls.value
}
const onVideoClick = () => {
  const v = video.value
  if (!v) return
  if (!touchWake) togglePlay(v)
  touchWake = false
  idle.poke()
}
const onSeek = (e: Event) => use((v) => (v.currentTime = Number((e.target as HTMLInputElement).value)))
const onSeekKey = (e: KeyboardEvent) => use((v) => handleSeekKey(e, v) && idle.poke())
const onVolume = (e: Event) =>
  use((v) => {
    v.volume = Number((e.target as HTMLInputElement).value)
    v.muted = v.volume === 0
  })

const pct = computed(() => (s.value.duration ? s.value.time / s.value.duration : 0))
const buffered = computed(() => (s.value.duration ? Math.min(1, s.value.buffered / s.value.duration) : 0))
const volume = computed(() => (s.value.muted ? 0 : s.value.volume))
const silent = computed(() => s.value.muted || s.value.volume === 0)
</script>

<template>
  <div
    ref="root"
    :class="styles.root"
    data-slot="video-player"
    :style="{ '--ratio': ratio }"
    role="region"
    :aria-label="words.player.replace('{title}', title)"
    :aria-describedby="hintId"
    tabindex="0"
    :data-idle="!showControls || undefined"
    :data-fullscreen="fullscreen || undefined"
    @keydown="onKeydown"
    @pointermove="$event.pointerType === 'mouse' && idle.poke()"
    @pointerleave="s.playing && (awake = false)"
  >
    <img
      v-if="poster && posterPlaceholder"
      :class="styles.posterPlaceholder"
      data-slot="video-player-poster-placeholder"
      :data-status="posterLoaded === poster || started ? 'loaded' : 'loading'"
      :src="posterPlaceholder"
      alt=""
      aria-hidden="true"
      draggable="false"
    />
    <video
      ref="video"
      :class="styles.video"
      data-slot="video-player-video"
      :src="sources ? undefined : src"
      :poster="poster"
      preload="metadata"
      playsinline
      :loop="loop"
      @pointerdown="onVideoPointerDown"
      @click="onVideoClick"
      @dblclick="support.fullscreen && toggleFullscreen()"
    >
      <source v-for="x in sources" :key="x.src" :src="x.src" :type="x.type" />
      <track v-for="t in tracks" :key="t.src" :src="t.src" :srclang="t.srclang" :label="t.label" :kind="t.kind ?? 'captions'" />
    </video>

    <div v-if="cueLines.length > 0" :class="styles.captions" data-slot="video-player-captions" :data-raised="showControls || undefined" aria-hidden="true">
      <span v-for="(line, i) in cueLines" :key="i" :class="styles.cue" data-slot="video-player-cue">{{ line }}</span>
    </div>

    <span v-if="buffering && !failed" :class="styles.buffering" data-slot="video-player-buffering">
      <Spinner size="lg" :label="words.buffering" />
    </span>

    <div v-if="failed" :class="styles.error" data-slot="video-player-error" role="alert">
      <p :class="styles.errorText" data-slot="video-player-error-text">{{ words.error }}</p>
      <Button variant="secondary" size="sm" @click="retry">{{ words.retry }}</Button>
    </div>

    <button v-if="!started && !failed" type="button" :class="styles.bigPlay" data-slot="video-player-start" aria-hidden="true" tabindex="-1" @click="use(togglePlay)">
      <PlayIcon />
    </button>

    <div :class="styles.controls" data-slot="video-player-controls" :data-hidden="!showControls || undefined" @focusin="onFocusIn" @focusout="onFocusOut">
      <div :class="[styles.range, styles.seek]" data-slot="video-player-seek" :style="{ '--p': pct, '--b': buffered }">
        <input
          type="range"
          :class="styles.rangeInput" data-slot="video-player-range-input"
          :aria-label="words.seek"
          :aria-valuetext="words.seekValue.replace('{current}', formatTime(s.time)).replace('{duration}', formatTime(s.duration))"
          min="0"
          :max="s.duration || 0"
          step="any"
          :value="Math.min(s.time, s.duration || 0)"
          :disabled="!s.duration"
          @input="onSeek"
          @keydown="onSeekKey"
        />
        <span :class="styles.track" data-slot="video-player-track" aria-hidden="true">
          <span :class="styles.buffered" data-slot="video-player-buffered" />
          <span :class="styles.fill" data-slot="video-player-range" />
          <span :class="styles.thumb" data-slot="video-player-thumb" />
        </span>
      </div>

      <div :class="styles.bar" data-slot="video-player-bar">
        <button type="button" :class="styles.btn" data-slot="video-player-button" :aria-label="s.playing ? words.pause : words.play" @click="use(togglePlay)">
          <PauseIcon v-if="s.playing" />
          <PlayIcon v-else />
        </button>

        <div :class="styles.volume" data-slot="video-player-volume">
          <button type="button" :class="styles.btn" data-slot="video-player-button" :aria-label="silent ? words.unmute : words.mute" @click="use((v) => toggleMute(v, silent))">
            <VolumeOffIcon v-if="silent" />
            <VolumeIcon v-else />
          </button>
          <div :class="[styles.range, styles.volumeRange]" data-slot="video-player-volume-range" :style="{ '--p': volume }">
            <input
              type="range"
              :class="styles.rangeInput" data-slot="video-player-range-input"
              :aria-label="words.volume"
              :aria-valuetext="words.volumeValue.replace('{value}', String(Math.round(volume * 100)))"
              min="0"
              max="1"
              step="0.05"
              :value="volume"
              @input="onVolume"
            />
            <span :class="styles.track" data-slot="video-player-track" aria-hidden="true">
              <span :class="styles.fill" data-slot="video-player-range" />
              <span :class="styles.thumb" data-slot="video-player-thumb" />
            </span>
          </div>
        </div>

        <span :class="styles.time" data-slot="video-player-time" aria-hidden="true">{{ formatTime(s.time) }}<template v-if="false" /> / <template v-if="false" />{{ formatTime(s.duration) }}</span>

        <span :class="styles.spacer" />

        <button v-if="tracks.length > 0" type="button" :class="styles.btn" data-slot="video-player-button" :aria-label="words.captions" :aria-pressed="captions" :data-state="captions ? 'on' : 'off'" @click="captions = !captions">
          <CaptionsIcon />
        </button>
        <SpeedMenu :rates="speeds" :rate="s.rate" :label="words.speed" :format="words.rate" tone="scrim" @rate="(r) => use((v) => (v.playbackRate = r))" @open-change="(o) => (menuOpen = o)" />
        <button v-if="support.pip" type="button" :class="[styles.btn, styles.pip]" data-slot="video-player-button" :aria-label="words.pip" :aria-pressed="pip" :data-state="pip ? 'on' : 'off'" @click="togglePip">
          <PipIcon />
        </button>
        <button v-if="support.fullscreen" type="button" :class="styles.btn" data-slot="video-player-button" :aria-label="fullscreen ? words.exitFullscreen : words.fullscreen" @click="toggleFullscreen">
          <ExitFullscreenIcon v-if="fullscreen" />
          <FullscreenIcon v-else />
        </button>
      </div>
    </div>

    <span :id="hintId" :class="styles.sr">{{ words.shortcuts }}</span>
    <span :class="styles.sr" aria-live="polite">{{ status }}</span>
  </div>
</template>
