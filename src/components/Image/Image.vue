<script setup lang="ts">
import { computed, ref, useAttrs, watch } from 'vue'
import Button from '../Button/Button.vue'
import styles from './Image.module.css'

// The Vue Image: the same box (Image.module.css) as the React one. It keeps its space, loads from a blurred
// placeholder into focus, and shows a calm fallback when it fails. class and style go to the box, other
// attributes and listeners, such as width or load, go to the img.
defineOptions({ inheritAttrs: false })

export type ImageLabels = {
  /** Text of the retry button. */
  retry: string
}

const {
  src,
  ratio,
  fit = 'cover',
  retry = false,
  rounded = true,
  labels: labelsProp,
  loading = 'lazy',
  decoding = 'async',
} = defineProps<{
  /** Required. Describe the picture, or pass "" when it is only decoration. */
  alt: string
  src?: string
  /** A tiny image (often a data URL) shown blurred while the real one loads. */
  placeholder?: string
  /** Width over height, such as 16 / 9 or "4 / 3". Reserves the space, so the page does not jump. */
  ratio?: number | string
  /** "cover" fills the box and crops, "contain" shows the whole image. */
  fit?: 'cover' | 'contain'
  /** Adds a "Try again" button to the fallback that loads the image again. */
  retry?: boolean
  /** Rounds the corners with the panel radius. */
  rounded?: boolean
  /** Text for the image's controls, so you can translate it. Missing keys use the English defaults. */
  labels?: Partial<ImageLabels>
  loading?: 'lazy' | 'eager'
  decoding?: 'async' | 'sync' | 'auto'
}>()
const labels = computed<ImageLabels>(() => ({ retry: 'Try again', ...labelsProp }))
defineSlots<{
  /** Shown when the image fails. Defaults to an icon with the alt text. */
  fallback?: () => unknown
}>()
const attrs = useAttrs()

type State = 'loading' | 'loaded' | 'error'
const state = ref<State>(src ? 'loading' : 'error')
// An instant (cached) image skips the fade, so it never flickers on a revisit.
const instant = ref(false)
const attempt = ref(0)
watch(
  () => src,
  (src) => {
    state.value = src ? 'loading' : 'error'
    instant.value = false
  },
)

const root = ref<HTMLElement | null>(null)
const rest = computed(() => {
  const { class: _class, style: _style, ...others } = attrs
  return others
})
const aspect = computed(() => (ratio !== undefined ? String(ratio) : attrs.width && attrs.height ? `${attrs.width} / ${attrs.height}` : undefined))
const showFallback = computed(() => state.value === 'error' || !src)

const checkCached = (el: unknown) => {
  const img = el as HTMLImageElement | null
  if (img && img.complete && img.naturalWidth > 0 && state.value === 'loading') {
    instant.value = true
    state.value = 'loaded'
  }
}
const tryAgain = () => {
  // The button goes away while the photo loads, so focus moves to the box and is not dropped.
  root.value?.focus()
  state.value = 'loading'
  attempt.value++
}
</script>

<template>
  <span
    ref="root"
    data-slot="image"
    :tabindex="retry ? -1 : undefined"
    :class="[styles.root, rounded && styles.rounded, aspect === undefined && styles.flow, attrs.class]"
    :style="[{ aspectRatio: aspect }, attrs.style as string]"
    :data-status="state"
    :data-instant="instant || undefined"
  >
    <img v-if="placeholder && state !== 'error'" data-slot="image-placeholder" :class="styles.placeholder" :src="placeholder" alt="" aria-hidden="true" />
    <img
      v-if="state !== 'error' && src"
      v-bind="rest"
      :key="attempt"
      :ref="checkCached"
      data-slot="image-img"
      :class="styles.img"
      :src="src"
      :alt="alt"
      :loading="loading"
      :decoding="decoding"
      :style="{ objectFit: fit }"
      @load="state = 'loaded'"
      @error="state = 'error'"
    />
    <span v-if="showFallback" data-slot="image-fallback" :class="styles.fallback" :role="alt && !retry ? 'img' : undefined" :aria-label="alt && !retry ? alt : undefined">
      <span v-if="retry" :class="styles.fallbackBody" :role="alt ? 'img' : undefined" :aria-label="alt || undefined">
        <slot name="fallback">
          <svg viewBox="0 0 24 24" data-slot="image-fallback-icon" :class="styles.fallbackIcon" aria-hidden="true" focusable="false">
            <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
            <circle cx="9" cy="10" r="1.75" />
            <path d="M20.5 15.5l-5-5-9 8.5" />
            <path d="M3 3l18 18" />
          </svg>
          <span v-if="alt" data-slot="image-fallback-text" :class="styles.fallbackText" aria-hidden="true">{{ alt }}</span>
        </slot>
      </span>
      <slot v-else name="fallback">
        <svg viewBox="0 0 24 24" data-slot="image-fallback-icon" :class="styles.fallbackIcon" aria-hidden="true" focusable="false">
          <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
          <circle cx="9" cy="10" r="1.75" />
          <path d="M20.5 15.5l-5-5-9 8.5" />
          <path d="M3 3l18 18" />
        </svg>
        <span v-if="alt" data-slot="image-fallback-text" :class="styles.fallbackText" aria-hidden="true">{{ alt }}</span>
      </slot>
      <Button v-if="retry && src" variant="secondary" size="sm" @click="tryAgain">{{ labels.retry }}</Button>
    </span>
  </span>
</template>
