<script setup lang="ts" generic="O extends { value: string; group?: string }">
import { computed, h, onBeforeUnmount, onMounted, ref, watch, type CSSProperties, type FunctionalComponent } from 'vue'
import { createOptionWindow, groupRuns, listRows, setPlaces } from './motion/optionList'
import styles from './OptionList.module.css'

// The Vue twin of OptionList.tsx: the highlight that moves between options, groups with their names, and only
// the options in view once the list is long (motion/optionList.ts). The default slot draws one option.
const { options, active, list, highlightClass, part, baseId } = defineProps<{
  /** The options to show, in order. Options of a group must sit together (byGroup). */
  options: O[]
  /** Index of the highlighted option, or -1. */
  active: number
  /** The scrolling list element. */
  list: HTMLElement | null
  /** The part's own class for the moving highlight. */
  highlightClass: string
  /** Prefix for data-slot, such as "combobox". */
  part: string
  baseId: string
}>()
defineSlots<{
  default(props: { option: O; index: number; attrs: Record<string, string | number>; at?: CSSProperties; setEl: (el: unknown) => void }): unknown
}>()

const tick = ref(0)
const win = createOptionWindow(() => tick.value++)
onBeforeUnmount(() => win.disconnect())
const rows = computed(() => listRows(options))
const places = computed(() => setPlaces(options))
const view = computed(() => (tick.value, win.layout(rows.value, list, active)))
const runs = computed(() => groupRuns(rows.value, view.value.drawn))
const at = (r: number): CSSProperties | undefined => (view.value.windowed ? { position: 'absolute', top: `${view.value.offsets[r]}px`, left: '0px', right: '0px' } : undefined)

const els = new Map<number, HTMLElement>()
const heads = new Map<number, HTMLElement>()
const track = (map: Map<number, HTMLElement>, key: number) => (el: unknown) => {
  const prev = map.get(key)
  if (el instanceof HTMLElement) {
    map.set(key, el)
    if (view.value.windowed) win.observe(el)
  } else if (prev) {
    map.delete(key)
    win.unobserve(prev)
  }
}
const props = (r: number) => {
  const row = rows.value[r] as { option: number; key: string }
  const i = row.option
  return {
    option: options[i],
    index: i,
    attrs: { 'aria-posinset': places.value.pos[i], 'aria-setsize': places.value.size[i], 'data-index': r, 'data-key': row.key },
    at: at(r),
    setEl: track(els, i),
  }
}

// A long list draws again as it scrolls; a short one has nothing to redraw.
let unlisten = () => {}
watch(
  [() => list, () => view.value.windowed],
  ([el, windowed]) => {
    unlisten()
    unlisten = () => {}
    if (!el || !windowed) return
    const onScroll = () => tick.value++
    el.addEventListener('scroll', onScroll, { passive: true })
    unlisten = () => el.removeEventListener('scroll', onScroll)
    onScroll()
  },
  { immediate: true },
)
onBeforeUnmount(() => unlisten())

const hl = ref<{ top: number; height: number } | null>(null)
const place = () => {
  const el = els.get(active)
  const next = el ? { top: el.offsetTop, height: el.offsetHeight } : null
  if (hl.value?.top !== next?.top || hl.value?.height !== next?.height) hl.value = next
}
// The active option stays in view while rows above it are measured, until the person scrolls the list.
let pinned = true
const reveal = () => pinned && els.get(active)?.scrollIntoView({ block: 'nearest' })
watch([() => active, () => options], () => ((pinned = true), reveal()), { flush: 'post' })
watch([view, () => active], () => (place(), reveal()), { flush: 'post' })
onMounted(() => (place(), reveal()))
const unpin = () => (pinned = false)
watch(
  () => list,
  (el, _, onCleanup) => {
    if (!el) return
    el.addEventListener('wheel', unpin, { passive: true })
    el.addEventListener('touchstart', unpin, { passive: true })
    el.addEventListener('pointerdown', unpin)
    onCleanup(() => {
      el.removeEventListener('wheel', unpin)
      el.removeEventListener('touchstart', unpin)
      el.removeEventListener('pointerdown', unpin)
    })
  },
  { immediate: true },
)

// A long list sits in a sized box the options are placed in; a short one adds no element.
const Space: FunctionalComponent<{ height: number | null }> = (p, { slots }) => (p.height === null ? slots.default?.() : h('div', { class: styles.space, style: { height: `${p.height}px` } }, slots.default?.()))
</script>

<template>
  <Space :height="view.windowed ? view.height : null">
    <span
      v-if="hl"
      :class="highlightClass"
      :data-slot="`${part}-highlight`"
      :style="{ transform: `translateY(${hl.top}px)`, height: `${hl.height}px`, ...(view.windowed ? { left: '0px', right: '0px' } : {}) }"
      aria-hidden="true"
    />
    <template v-for="(run, n) in runs" :key="run.head === undefined ? `run${n}` : rows[run.head].key">
      <div v-if="run.head !== undefined" role="group" :aria-labelledby="`${baseId}-group-${run.head}`" :data-slot="`${part}-group`">
        <div
          :id="`${baseId}-group-${run.head}`"
          :ref="track(heads, run.head)"
          role="presentation"
          :data-index="run.head"
          :data-key="rows[run.head].key"
          :data-slot="`${part}-group-label`"
          :class="styles.groupLabel"
          :style="at(run.head)"
        >
          {{ run.group }}
        </div>
        <template v-for="r in run.rows" :key="rows[r].key"><slot v-bind="props(r)" /></template>
      </div>
      <template v-else>
        <template v-for="r in run.rows" :key="rows[r].key"><slot v-bind="props(r)" /></template>
      </template>
    </template>
  </Space>
</template>
