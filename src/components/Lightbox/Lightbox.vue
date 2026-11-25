<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import { trapFocus } from '../../internal/motion/focus'
import { dismissable, lockScroll } from '../../internal/motion/layers'
import { createLightbox, preloadAround } from '../../internal/motion/lightbox'
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from '../../icons/vue'
import styles from './Lightbox.module.css'

// The Vue Lightbox: the same look (Lightbox.module.css), zoom, swipe, keys and focus as the React one.

export type LightboxImage = {
  src: string
  alt: string
  thumb?: string
  /** A tiny image, usually a data URL, shown blurred until the photo loads. */
  placeholder?: string
  caption?: string
}
export type LightboxLabels = { viewer: string; close: string; prev: string; next: string; counter: string; open: string }

const props = defineProps<{
  /** All pictures the viewer can page through, in order. Each alt is required, and read as its name. */
  images: LightboxImage[]
  /** Returns the thumbnail for an index, so the image zooms out of it and back into it. */
  getOrigin?: (index: number) => HTMLElement | null
  /** Text for screen readers and the counter, so you can translate it. {n}, {total} and {alt} are filled in. */
  labels?: Partial<LightboxLabels>
}>()
/** Shown under the photo instead of its caption or alt. */
defineSlots<{ caption?: (p: { image: LightboxImage; index: number }) => unknown }>()

/** The open image, or null when closed. Use v-model:index; the close button, Esc and a pull down set it null. */
const index = defineModel<number | null>('index', { default: null })
const words = computed(() => ({ viewer: 'Image viewer', close: 'Close', prev: 'Previous image', next: 'Next image', counter: '{n} of {total}', open: 'Open {alt}', ...props.labels }))
const titleId = useId()
const open = computed(() => index.value !== null)
const total = computed(() => props.images.length)
const shown = ref<number | null>(index.value)
const closing = ref(false)
const dir = ref<'next' | 'prev' | undefined>(undefined)
const root = ref<HTMLElement | null>(null)
const scrim = ref<HTMLElement | null>(null)
const img = ref<HTMLImageElement | null>(null)
const item = computed(() => (shown.value === null ? undefined : props.images[shown.value]))
const counter = computed(() => words.value.counter.replace('{n}', String((shown.value ?? 0) + 1)).replace('{total}', String(total.value)))
let zoomed = false
// Photos that have loaded, by src. A cached one skips its placeholder.
const loaded = ref<Record<string, 'load' | 'cached'>>({})
const markLoaded = (src: string, how: 'load' | 'cached') => {
  if (!loaded.value[src]) loaded.value[src] = how
}

// Zoom, swipe, pull down and keys (motion/lightbox.ts).
const box = createLightbox(
  () => img.value,
  () => scrim.value,
  () => ({ index: index.value, total: total.value, getOrigin: props.getOrigin }),
  (n) => (index.value = n),
)
const close = () => (index.value = null)

// Keeps the last image while the close animation runs.
watch(
  index,
  (i) => {
    if (i !== null) {
      if (shown.value !== null && shown.value !== i) dir.value = i > shown.value ? 'next' : 'prev'
      shown.value = i
      closing.value = false
    } else if (shown.value !== null && !closing.value) closing.value = true
  },
  { flush: 'sync' },
)

// On the server (Nuxt) there is no page to hold, so the watchers wait for the browser.
const server = typeof window === 'undefined'
let release: Array<() => void> = []
const stop = () => {
  release.forEach((r) => r())
  release = []
}
watch(
  open,
  (now) => {
    if (server) return
    stop()
    if (now && root.value) release.push(lockScroll(), trapFocus(root.value, { modal: true }), dismissable(() => [root.value], close, { outside: false }))
    if (now && !zoomed) {
      zoomed = true
      dir.value = undefined
      box.zoomIn(index.value as number)
    }
  },
  { immediate: true, flush: 'post' },
)
watch(
  closing,
  (now) => {
    if (!now || shown.value === null) return
    box.zoomOut(shown.value, () => {
      shown.value = null
      closing.value = false
      zoomed = false
    })
  },
  { flush: 'post' },
)
watch(
  () => item.value?.src,
  (src) => {
    const el = img.value
    if (src && el?.complete && el.naturalWidth) markLoaded(src, 'cached')
  },
  { immediate: true, flush: 'post' },
)
watch(shown, (n) => n !== null && preloadAround(n, props.images.map((i) => i.src)), { immediate: !server })

onBeforeUnmount(() => {
  stop()
  box.destroy()
})

const onKeydown = (e: KeyboardEvent) => {
  if (box.key(e.key)) e.preventDefault()
}
</script>

<template>
  <Teleport v-if="shown !== null && item" to="body">
    <div ref="root" role="dialog" aria-modal="true" :aria-label="words.viewer" :aria-describedby="titleId" tabindex="-1" data-slot="lightbox" :class="styles.root" :data-state="closing ? 'closed' : 'open'" @keydown="onKeydown">
      <div ref="scrim" data-slot="lightbox-overlay" :class="styles.scrim" aria-hidden="true" />
      <div data-slot="lightbox-stage" :class="styles.stage" @pointerdown="box.down" @pointermove="box.move" @pointerup="box.up" @pointercancel="box.up">
        <img
          v-if="item.placeholder && loaded[item.src] !== 'cached'"
          :key="`placeholder-${shown}`"
          data-slot="lightbox-placeholder"
          :class="styles.placeholder"
          :data-status="loaded[item.src] ? 'loaded' : 'loading'"
          :src="item.placeholder"
          alt=""
          aria-hidden="true"
          draggable="false"
        />
        <img :key="shown" ref="img" data-slot="lightbox-img" :class="styles.img" :data-dir="dir" :src="item.src" :alt="item.alt" draggable="false" @load="markLoaded(item.src, 'load')" @error="markLoaded(item.src, 'load')" />
      </div>
      <button type="button" data-slot="lightbox-close" :class="[styles.btn, styles.close]" :aria-label="words.close" @click="close">
        <XIcon />
      </button>
      <div :class="styles.bar">
        <!-- aria-disabled, not disabled: a disabled button drops focus to the body and the arrow keys stop working -->
        <button v-if="total > 1" type="button" data-slot="lightbox-prev" :class="[styles.btn, styles.prev]" :aria-label="words.prev" :aria-disabled="shown === 0" @click="box.go(shown - 1)">
          <ChevronLeftIcon />
        </button>
        <div :id="titleId" :class="styles.info" aria-live="polite">
          <span v-if="total > 1" data-slot="lightbox-counter" :class="styles.counter">{{ counter }}</span>
          <span data-slot="lightbox-caption" :class="styles.caption"><slot name="caption" :image="item" :index="shown">{{ item.caption ?? item.alt }}</slot></span>
        </div>
        <button v-if="total > 1" type="button" data-slot="lightbox-next" :class="[styles.btn, styles.next]" :aria-label="words.next" :aria-disabled="shown === total - 1" @click="box.go(shown + 1)">
          <ChevronRightIcon />
        </button>
      </div>
    </div>
  </Teleport>
</template>
