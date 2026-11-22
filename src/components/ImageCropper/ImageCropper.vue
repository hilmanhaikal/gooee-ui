<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId, watch } from 'vue'
import { BUTTON_ZOOM, centreCrop, clampCrop, createImageCropper, cropImageStyle, getCropArea, type CropArea, type CropSize, type ImageCrop } from '../../internal/motion/imageCropper'
import { MinusIcon, PlusIcon } from '../../icons/vue'
import { ratioNumber } from '../../internal/ratio'
import IconButton from '../IconButton/IconButton.vue'
import Slider from '../Slider/Slider.vue'
import styles from './ImageCropper.module.css'

// The Vue ImageCropper: the same look (ImageCropper.module.css), drag, pinch, wheel and keys as the React one.

export type ImageCropperLabels = { zoom: string; zoomOut: string; zoomIn: string; help: string }

const { src, ratio = 1, round = false, defaultValue = centreCrop, minZoom = 1, maxZoom = 3, labels } = defineProps<{
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
  /** Starting crop when there is no v-model. */
  defaultValue?: ImageCrop
  /** Least zoom. 1 means the photo just covers the frame. */
  minZoom?: number
  /** Most zoom. */
  maxZoom?: number
  /** Passed to the img, such as "anonymous" when you will read the cut pixels from a canvas. */
  crossOrigin?: '' | 'anonymous' | 'use-credentials'
  /** Words for other languages. */
  labels?: Partial<ImageCropperLabels>
}>()
const emit = defineEmits<{
  /** The crop in the photo's pixels, once it loads and after every change. Cut it with a canvas. */
  cropAreaChange: [area: CropArea]
}>()

/** The crop. Use v-model, or leave it out and the cropper keeps its own. */
const model = defineModel<ImageCrop>()
const local = ref(defaultValue)
const words = computed(() => ({ zoom: 'Zoom', zoomOut: 'Zoom out', zoomIn: 'Zoom in', help: 'Use the arrow keys to move the photo, and plus and minus to zoom.', ...labels }))
const helpId = useId()
const stage = ref<HTMLElement | null>(null)
const img = ref<HTMLImageElement | null>(null)
const size = ref<CropSize | null>(null)
const active = ref(false)
const aspect = computed(() => ratioNumber(ratio))
const crop = computed(() => clampCrop(model.value ?? local.value, size.value, aspect.value, minZoom, maxZoom))

// Drag, pinch, wheel, tap and keys (motion/imageCropper.ts).
const cropper = createImageCropper(
  () => stage.value,
  () => ({ size: size.value, aspect: aspect.value, minZoom, maxZoom }),
  (c) => {
    local.value = c
    model.value = c
  },
  (on) => (active.value = on),
)
watch(crop, (c) => cropper.sync(c), { immediate: true, flush: 'sync' })

// A cached photo can finish loading before Vue listens for load.
const readSize = () => {
  const el = img.value
  if (el?.complete && el.naturalWidth) size.value = { width: el.naturalWidth, height: el.naturalHeight }
}
onMounted(readSize)
watch(
  () => src,
  () => {
    size.value = null
    nextTick(readSize)
  },
)

const areaKey = computed(() => (size.value ? JSON.stringify(getCropArea(crop.value, size.value, aspect.value)) : ''))
watch(areaKey, (key) => key && emit('cropAreaChange', JSON.parse(key)))

const onLoad = (e: Event) => {
  const el = e.currentTarget as HTMLImageElement
  size.value = { width: el.naturalWidth, height: el.naturalHeight }
}
const onKeydown = (e: KeyboardEvent) => {
  if (cropper.key(e)) e.preventDefault()
}
</script>

<template>
  <div data-slot="image-cropper" :class="styles.root">
    <div
      ref="stage"
      data-slot="image-cropper-stage"
      :class="styles.stage"
      :style="{ aspectRatio: aspect }"
      tabindex="0"
      role="group"
      aria-roledescription="crop frame"
      :aria-label="label"
      :aria-describedby="helpId"
      :data-round="round || undefined"
      :data-active="active || undefined"
      :data-ready="size ? true : undefined"
      @pointerdown="cropper.down"
      @pointermove="cropper.move"
      @pointerup="cropper.up"
      @pointercancel="cropper.up"
      @wheel="cropper.wheel"
      @keydown="onKeydown"
    >
      <img v-if="placeholder" data-slot="image-cropper-placeholder" :class="styles.placeholder" :src="placeholder" alt="" aria-hidden="true" draggable="false" />
      <img
        :key="src"
        ref="img"
        data-slot="image-cropper-img"
        :class="styles.img"
        :src="src"
        alt=""
        :crossorigin="crossOrigin"
        draggable="false"
        :style="cropImageStyle(crop, size, aspect)"
        @load="onLoad"
      />
      <span data-slot="image-cropper-guides" :class="styles.guides" aria-hidden="true" />
    </div>
    <p :id="helpId" data-slot="image-cropper-help" :class="styles.srOnly">{{ words.help }}</p>
    <div data-slot="image-cropper-zoom" :class="styles.zoom">
      <IconButton :label="words.zoomOut" variant="secondary" @click="cropper.zoomTo(crop.zoom / BUTTON_ZOOM)">
        <template #icon><MinusIcon /></template>
      </IconButton>
      <Slider
        :class="styles.slider"
        :label="words.zoom"
        :min="minZoom"
        :max="maxZoom"
        :step="0.01"
        :model-value="crop.zoom"
        :format-value="(z: number) => `${Math.round(z * 100)}%`"
        @update:model-value="(z: number | undefined) => z !== undefined && cropper.zoomTo(z)"
      />
      <IconButton :label="words.zoomIn" variant="secondary" @click="cropper.zoomTo(crop.zoom * BUTTON_ZOOM)">
        <template #icon><PlusIcon /></template>
      </IconButton>
    </div>
  </div>
</template>
