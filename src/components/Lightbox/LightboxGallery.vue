<script setup lang="ts">
import { computed, ref } from 'vue'
import Image from '../Image/Image.vue'
import Lightbox, { type LightboxImage, type LightboxLabels } from './Lightbox.vue'
import styles from './Lightbox.module.css'

// The Vue LightboxGallery: a grid of thumbnails wired to a Lightbox, as in React. A class and a style go to the grid.
defineOptions({ inheritAttrs: false })

const { ratio = 1, labels } = defineProps<{
  /** Pictures shown as thumbnails and opened in the viewer. */
  images: LightboxImage[]
  /** Width over height of each thumbnail. */
  ratio?: number | string
  /** Text for screen readers and the counter, so you can translate it. */
  labels?: Partial<LightboxLabels>
}>()

const index = ref<number | null>(null)
const thumbs: Array<HTMLElement | null> = []
const open = computed(() => labels?.open ?? 'Open {alt}')
</script>

<template>
  <ul v-bind="$attrs" data-slot="lightbox-gallery" :class="styles.grid">
    <li v-for="(img, i) in images" :key="img.src">
      <button :ref="(el) => (thumbs[i] = el as HTMLElement | null)" type="button" data-slot="lightbox-gallery-thumb" :class="styles.thumb" :aria-label="open.replace('{alt}', img.alt)" @click="index = i">
        <Image :src="img.thumb ?? img.src" alt="" :ratio="ratio" :placeholder="img.placeholder" />
      </button>
    </li>
  </ul>
  <Lightbox v-model:index="index" :images="images" :get-origin="(i: number) => thumbs[i]" :labels="labels" />
</template>
