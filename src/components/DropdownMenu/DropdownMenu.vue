<script lang="ts">
import type { Component } from 'vue'

export type DropdownMenuRadioOption = {
  value: string
  label: string
  shortcut?: string
  disabled?: boolean
}

export type DropdownMenuEntry =
  | {
      type?: 'item'
      label: string
      /** An icon component, such as EditIcon from the icons. */
      icon?: Component
      shortcut?: string
      onSelect?: () => void
      /** Makes the item a link to this address. onSelect still runs first. */
      href?: string
      disabled?: boolean
      /** Why the item is disabled. Shown as small text under the label while it is disabled. */
      disabledReason?: string
      /** Marks a destructive action in red and bold. Use a clear word too, such as "Delete". */
      destructive?: boolean
      /** Turns the item into a submenu. */
      items?: DropdownMenuEntry[]
    }
  | {
      type: 'checkbox'
      label: string
      checked: boolean
      onCheckedChange: (checked: boolean) => void
      shortcut?: string
      disabled?: boolean
    }
  | {
      type: 'radio'
      /** Visible name of the group. It also names the group for screen readers. */
      label?: string
      value: string
      onValueChange: (value: string) => void
      options: DropdownMenuRadioOption[]
    }
  | { type: 'separator' }
  | { type: 'label'; label: string }
</script>

<script setup lang="ts">
import { onBeforeUnmount, ref, shallowRef, useId, watch, type VNode } from 'vue'
import type { Align } from '../../internal/motion/floating'
import { dismissable } from '../../internal/motion/layers'
import { createMorph } from '../../internal/motion/liquid'
import { createBead } from '../../internal/motion/liquidMore'
import { createMenuKeys, menuButtonKey, menuItems } from '../../internal/motion/menuKeys'
import { useFloating } from '../../internal/vue/useFloating'
import { usePresence } from '../../internal/vue/usePresence'
import { cloneTrigger, elementRef, firstNode } from '../../internal/vue/trigger'
import DropdownMenuPanel from './DropdownMenuPanel.vue'
import styles from './DropdownMenu.module.css'

// The Vue DropdownMenu: the same look (DropdownMenu.module.css), keys, growth and bead as the React one.
// The trigger slot is one button that opens the menu. It gets the menu ARIA attributes, and an id if it has none.

const { items, align = 'start' } = defineProps<{
  /** Items, checkbox and radio items, submenus, separators and group labels, in menu order. */
  items: DropdownMenuEntry[]
  /** Accessible name for the menu, if the trigger text is not enough. */
  label?: string
  /** Which edge of the trigger the menu lines up with. */
  align?: Align
}>()
const slots = defineSlots<{ trigger?: () => VNode[] }>()

const id = useId()
const open = ref(false)
const focusAt = ref<'first' | 'last'>('first')
const anchor = shallowRef<HTMLElement | null>(null)
const setAnchor = elementRef(anchor)
const menu = ref<HTMLElement | null>(null)
const { mounted, state } = usePresence(open, 'morph-out')
const { style, side: placed, ready } = useFloating(anchor, menu, mounted, () => ({ side: 'bottom', align, offset: 6 }))
// Vue sets a bare number as no length at all, so the place gets its unit here.
// The menu grows out of its button and folds back into it.
const liquid = createMorph(() => menu.value, { origin: () => anchor.value })
watch([state, () => mounted.value && ready.value], ([s, on]) => on && liquid.play(s), { flush: 'post' })

// The hover fill is a bead that follows the pointer from item to item.
let stopBead = () => {}
watch(
  mounted,
  (on) => {
    stopBead()
    stopBead = on && menu.value ? createBead(menu.value, { className: styles.bead }).destroy : () => {}
  },
  { flush: 'post' },
)

const close = (focusTrigger = true) => {
  open.value = false
  if (focusTrigger) anchor.value?.focus()
}
let releaseDismiss = () => {}
watch(open, (now) => {
  releaseDismiss()
  releaseDismiss = now ? dismissable(() => [anchor.value, menu.value], (reason) => close(reason === 'escape')) : () => {}
})

watch(
  [open, focusAt],
  () => {
    if (!open.value) return
    const list = menuItems(menu.value)
    ;(focusAt.value === 'first' ? list[0] : list[list.length - 1])?.focus({ preventScroll: true })
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  releaseDismiss()
  stopBead()
  liquid.destroy()
})

const openMenu = (at: 'first' | 'last') => {
  focusAt.value = at
  open.value = true
}

// Arrows, Home, End, type-ahead and Tab (motion/menuKeys.ts).
const onMenuKey = createMenuKeys(
  () => menu.value,
  () => close(),
)

// A caller's id on the trigger wins, so their own labels and tests keep working. Read in the same render, after the trigger.
let triggerId = `${id}-trigger`
// The trigger is the slot's own element, given the menu's ARIA, click and keys, like React's cloneElement.
const trigger = () => {
  const node = firstNode(slots.trigger?.())
  if (!node) return null
  triggerId = (node.props?.id as string | undefined) ?? `${id}-trigger`
  return cloneTrigger(node, setAnchor, {
    id: triggerId,
    'aria-haspopup': 'menu',
    'aria-expanded': open.value,
    'aria-controls': open.value ? id : undefined,
    onClick: () => (open.value ? close() : openMenu('first')),
    onKeydown: (e: KeyboardEvent) => {
      const at = menuButtonKey(e)
      if (at) openMenu(at)
    },
  })
}
const labelledBy = () => triggerId
</script>

<template>
  <component :is="trigger()" />
  <Teleport v-if="mounted" to="body">
    <div
      :id="id"
      ref="menu"
      role="menu"
      :aria-label="label"
      :aria-labelledby="label ? undefined : labelledBy()"
      data-slot="dropdown-menu-content"
      :class="styles.menu"
      :data-state="state"
      :data-side="placed"
      :style="style"
      @keydown="onMenuKey"
    >
      <DropdownMenuPanel :entries="items" :id-base="id" @close="close()" />
    </div>
  </Teleport>
</template>
