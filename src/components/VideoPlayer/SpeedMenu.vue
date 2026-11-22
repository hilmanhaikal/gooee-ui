<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { speedMenuKey } from '../../internal/motion/media'
import styles from './SpeedMenu.module.css'

// The Vue SpeedMenu: a menu button with radio items, as in React. It stays inside the player, so it still shows in full screen.

const props = defineProps<{
  rates: number[]
  rate: number
  /** Name of the button and menu, such as "Playback speed". */
  label: string
  /** Visible rate text, with {rate} filled in. */
  format: string
  tone: 'scrim' | 'surface'
}>()
const emit = defineEmits<{ rate: [rate: number]; openChange: [open: boolean] }>()

const id = useId()
const open = ref(false)
const active = ref(0)
const button = ref<HTMLButtonElement | null>(null)
const menu = ref<HTMLElement | null>(null)
const items: Array<HTMLElement | null> = []
const text = (r: number) => props.format.replace('{rate}', String(r))
const current = computed(() => Math.max(0, props.rates.indexOf(props.rate)))

const setOpen = (next: boolean) => {
  open.value = next
  emit('openChange', next)
}
const show = (index: number) => {
  active.value = index
  setOpen(true)
}
const close = () => {
  setOpen(false)
  button.value?.focus()
}

watch([open, active], () => open.value && nextTick(() => items[active.value]?.focus()))

const onPointer = (e: PointerEvent) => {
  const t = e.target as Node
  if (!menu.value?.contains(t) && !button.value?.contains(t)) setOpen(false)
}
watch(open, (now) => (now ? document.addEventListener('pointerdown', onPointer) : document.removeEventListener('pointerdown', onPointer)))
onBeforeUnmount(() => typeof document !== 'undefined' && document.removeEventListener('pointerdown', onPointer))

const onButtonKey = (e: KeyboardEvent) => {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
  e.preventDefault()
  e.stopPropagation()
  show(e.key === 'ArrowUp' ? props.rates.length - 1 : current.value)
}
const onMenuKey = (e: KeyboardEvent) => {
  const next = speedMenuKey(e.key, active.value, props.rates.length)
  if (next === null) return
  if (next === 'tab') return setOpen(false)
  e.preventDefault()
  e.stopPropagation()
  if (next === 'close') close()
  else active.value = next
}
const pick = (r: number) => {
  emit('rate', r)
  close()
}
</script>

<template>
  <div :class="[styles.root, styles[tone]]" data-slot="speed-menu">
    <button
      ref="button"
      type="button"
      :class="styles.button"
      data-slot="speed-menu-trigger"
      :data-state="open ? 'open' : 'closed'"
      :aria-label="`${label}, ${text(rate)}`"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-controls="open ? id : undefined"
      @click="open ? setOpen(false) : show(current)"
      @keydown="onButtonKey"
    >{{ text(rate) }}</button>
    <div v-if="open" :id="id" ref="menu" role="menu" :aria-label="label" :class="styles.menu" data-slot="speed-menu-content" @keydown="onMenuKey">
      <button
        v-for="(r, i) in rates"
        :key="r"
        :ref="(el) => (items[i] = el as HTMLElement | null)"
        type="button"
        role="menuitemradio"
        :aria-checked="r === rate"
        :tabindex="i === active ? 0 : -1"
        :class="styles.item"
        data-slot="speed-menu-item"
        :data-state="r === rate ? 'checked' : 'unchecked'"
        @click="pick(r)"
      >
        <span :class="styles.check" aria-hidden="true" />{{ text(r) }}
      </button>
    </div>
  </div>
</template>
