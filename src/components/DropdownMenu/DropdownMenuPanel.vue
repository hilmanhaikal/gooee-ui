<script setup lang="ts">
import { computed, h, onBeforeUnmount, onMounted, ref, watch, type FunctionalComponent, type StyleValue } from 'vue'
import { createPanelKeys, ownItems } from '../../internal/motion/contextMenu'
import { createBead } from '../../internal/motion/liquidMore'
import { placeSubmenu, type SubmenuPlace } from '../../internal/motion/menubar'
import { menuEntryKey, menuSections } from '../../internal/motion/menuModel'
import { CheckIcon, ChevronRightIcon } from '../../icons/vue'
import type { DropdownMenuEntry } from './DropdownMenu.vue'
import styles from './DropdownMenu.module.css'

// The rows of the Vue DropdownMenu (DropdownMenu.vue): in the root menu, or, with `sub`, a submenu panel of its
// own beside the item that opened it. The same rows, keys and look as the React one.

const { entries, idBase, sub = false, label = '', autoFocus = false } = defineProps<{
  entries: DropdownMenuEntry[]
  /** Prefix for the ids of group names and disabled reasons. */
  idBase: string
  /** A submenu: its own panel, placed beside its item. */
  sub?: boolean
  label?: string
  /** A submenu moves focus to its first item once placed, when opened by keyboard or click. */
  autoFocus?: boolean
}>()
const emit = defineEmits<{
  /** Closes the whole menu. */
  close: []
  /** This submenu closes; focus goes back to the item that opened it. */
  back: [parentItem: HTMLElement | null]
}>()

type Item = Extract<DropdownMenuEntry, { label: string; type?: 'item' }>
type Row = {
  key: string
  i: number
  role: 'menuitem' | 'menuitemcheckbox' | 'menuitemradio'
  label: string
  icon?: Item['icon']
  shortcut?: string
  checked?: boolean
  href?: string
  disabled?: boolean
  reason?: string
  destructive?: boolean
  items?: DropdownMenuEntry[]
  n: number
  run: () => void
}

// Each section with its rows ready to draw; `n` counts rows for the stagger.
const sections = computed(() => {
  let n = 0
  return menuSections(entries).map((s) => {
    const head = entries[s.at]
    const rows: Row[] = []
    if (head.type === 'radio')
      head.options.forEach((o) =>
        rows.push({ key: `${s.at}-${o.value}`, i: s.at, role: 'menuitemradio', label: o.label, shortcut: o.shortcut, checked: o.value === head.value, disabled: o.disabled, n: n++, run: () => head.onValueChange(o.value) }),
      )
    for (const i of head.type === 'radio' ? [] : s.rows) {
      const e = entries[i]
      if (e.type === 'checkbox') rows.push({ key: String(i), i, role: 'menuitemcheckbox', label: e.label, shortcut: e.shortcut, checked: e.checked, disabled: e.disabled, n: n++, run: () => e.onCheckedChange(!e.checked) })
      else if (e.type === undefined || e.type === 'item')
        rows.push({
          key: String(i),
          i,
          role: 'menuitem',
          label: e.label,
          icon: e.icon,
          shortcut: e.shortcut,
          href: e.href,
          disabled: e.disabled,
          reason: e.disabled ? e.disabledReason : undefined,
          destructive: e.destructive,
          items: e.items,
          n: n++,
          run: () => e.onSelect?.(),
        })
    }
    return { at: s.at, head, rows, group: head.type === 'label' || head.type === 'radio', name: 'label' in head ? head.label : undefined }
  })
})

// Once any row can be checked, every row keeps the check column, so all the labels line up.
const hasCheck = computed(() => entries.some((e) => e.type === 'checkbox' || e.type === 'radio'))
const open = ref<{ index: number; focus: boolean } | null>(null)
let hoverTimer: number | undefined
const hasSub = (r: Row) => Boolean(r.items?.length)
const isLink = (r: Row) => Boolean(r.href) && !r.disabled && !hasSub(r)
// A click or a key wins over a hover still waiting to act.
const openSub = (r: Row) => {
  window.clearTimeout(hoverTimer)
  open.value = { index: r.i, focus: true }
}
const choose = (r: Row, keepOpen: boolean) => {
  window.clearTimeout(hoverTimer)
  if (r.disabled) return
  if (hasSub(r)) return openSub(r)
  if (!keepOpen) emit('close')
  r.run()
}
const enter = (r: Row) => {
  window.clearTimeout(hoverTimer)
  if (r.disabled) return
  // A short wait, so passing over an item on the way to a submenu does not swap it.
  hoverTimer = window.setTimeout(() => (open.value = hasSub(r) ? { index: r.i, focus: false } : null), 120)
}
const pointTo = (r: Row, e: PointerEvent) => {
  if (!r.disabled && document.activeElement !== e.currentTarget) (e.currentTarget as HTMLElement).focus()
}
const onItemKey = (r: Row, e: KeyboardEvent) => {
  if (r.disabled) return
  // Enter on a link follows it the browser's way, so a modifier can open it in a new tab.
  if (isLink(r) && e.key === 'Enter') return
  const el = e.currentTarget as HTMLElement
  menuEntryKey(e, { openSub: hasSub(r) ? () => openSub(r) : undefined, run: (keep) => (isLink(r) ? el.click() : choose(r, keep)), checkable: r.role !== 'menuitem' })
}
const back = (el: HTMLElement | null) => {
  open.value = null
  el?.focus()
}

// A submenu: its place beside the item, its bead, and its own keys (motion/contextMenu.ts).
const panel = ref<HTMLElement | null>(null)
const pos = ref<SubmenuPlace | null>(null)
let stopBead = () => {}
onMounted(() => {
  if (!sub || !panel.value) return
  // The parent menu may still be growing open, and its outline would clip this submenu: finish it at once.
  panel.value.parentElement?.closest('[role="menu"]')?.getAnimations().forEach((a) => a.finish())
  stopBead = createBead(panel.value, { className: styles.bead }).destroy
  pos.value = placeSubmenu(panel.value)
})
watch([() => pos.value !== null, () => autoFocus], () => sub && pos.value && autoFocus && ownItems(panel.value)[0]?.focus({ preventScroll: true }), { flush: 'post' })
onBeforeUnmount(() => {
  window.clearTimeout(hoverTimer)
  stopBead()
})
const onPanelKey = createPanelKeys(() => panel.value, {
  submenu: () => true,
  onBack: () => emit('back', panel.value?.parentElement?.querySelector<HTMLElement>(':scope > [role="menuitem"]') ?? null),
  onClose: () => emit('close'),
})
const subStyle = computed<StyleValue>(() =>
  pos.value
    ? Object.fromEntries(Object.entries(pos.value).map(([k, v]) => [k, typeof v === 'number' ? `${v}px` : v]))
    : { position: 'absolute', top: '0px', left: '0px', opacity: 0, pointerEvents: 'none' as const },
)

// The root menu's rows sit straight in DropdownMenu.vue's panel; a submenu gets a panel of its own.
const Frame: FunctionalComponent<{ on: boolean }> = (p, { slots }) =>
  p.on
    ? h('div', { ref: panel, role: 'menu', 'aria-label': label, 'data-slot': 'dropdown-menu-sub-content', class: styles.menu, 'data-sub': '', style: subStyle.value, onKeydown: onPanelKey }, slots.default?.())
    : slots.default?.()
// Rows with no label above them sit straight in the menu, with no group around them.
const Group: FunctionalComponent<{ on: boolean; labelledBy?: string }> = (p, { slots }) =>
  p.on ? h('div', { role: 'group', 'aria-labelledby': p.labelledBy, 'data-slot': 'dropdown-menu-group' }, slots.default?.()) : slots.default?.()
// Declared, so Vue turns labelled-by into labelledBy.
Frame.props = ['on']
Group.props = ['on', 'labelledBy']
</script>

<template>
  <Frame :on="sub">
    <template v-for="s in sections" :key="s.at">
      <div v-if="s.head.type === 'separator'" role="separator" data-slot="dropdown-menu-separator" :class="styles.separator" />
      <!-- A label names the items under it, so a screen reader says "Sort, group" before the first one. -->
      <Group v-else :on="s.group" :labelled-by="s.name ? `${idBase}-g${s.at}` : undefined">
        <div v-if="s.group && s.name" :id="`${idBase}-g${s.at}`" role="presentation" data-slot="dropdown-menu-label" :class="styles.groupLabel">{{ s.name }}</div>
        <div v-for="r in s.rows" :key="r.key" role="none" :class="styles.itemWrap">
          <component
            :is="isLink(r) ? 'a' : 'div'"
            :href="isLink(r) ? r.href : undefined"
            :role="r.role"
            tabindex="-1"
            :aria-checked="r.role === 'menuitem' ? undefined : Boolean(r.checked)"
            :aria-disabled="r.disabled || undefined"
            :aria-describedby="r.reason ? `${idBase}-r${r.key}` : undefined"
            :aria-haspopup="hasSub(r) ? 'menu' : undefined"
            :aria-expanded="hasSub(r) ? open?.index === r.i : undefined"
            :data-slot="hasSub(r) ? 'dropdown-menu-sub-trigger' : 'dropdown-menu-item'"
            :data-state="hasSub(r) ? (open?.index === r.i ? 'open' : 'closed') : undefined"
            :class="styles.item"
            :data-disabled="r.disabled || undefined"
            :data-destructive="r.destructive || undefined"
            :style="{ '--i': Math.min(r.n, 12) }"
            @pointerenter="enter(r)"
            @pointermove="pointTo(r, $event)"
            @click="choose(r, false)"
            @keydown="onItemKey(r, $event)"
          >
            <span v-if="hasCheck" data-slot="dropdown-menu-item-indicator" :class="styles.check" aria-hidden="true">
              <template v-if="r.role !== 'menuitem' && r.checked"><span v-if="r.role === 'menuitemradio'" :class="styles.dot" /><CheckIcon v-else /></template>
            </span>
            <span v-if="r.icon" data-slot="dropdown-menu-item-icon" :class="styles.icon"><component :is="r.icon" /></span>
            <span data-slot="dropdown-menu-item-label" :class="styles.label">{{ r.label }}<span v-if="r.reason" :id="`${idBase}-r${r.key}`" data-slot="dropdown-menu-item-reason" :class="styles.reason">{{ r.reason }}</span></span>
            <kbd v-if="r.shortcut" data-slot="dropdown-menu-shortcut" :class="styles.shortcut">{{ r.shortcut }}</kbd>
            <ChevronRightIcon v-if="hasSub(r)" data-slot="dropdown-menu-sub-icon" :class="styles.chevron" />
          </component>
          <!-- A submenu only takes focus when opened by keyboard or click, so hovering does not steal it. -->
          <DropdownMenuPanel
            v-if="hasSub(r) && open?.index === r.i"
            :entries="r.items!"
            :id-base="`${idBase}-${r.i}`"
            sub
            :label="r.label"
            :auto-focus="open.focus"
            @close="emit('close')"
            @back="back"
          />
        </div>
      </Group>
    </template>
  </Frame>
</template>
