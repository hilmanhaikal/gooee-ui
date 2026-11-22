<script setup lang="ts">
import { computed, onUpdated, ref, useId } from 'vue'
import { isValidDate, relativeTime, toDate } from '../../internal/relativeTime'
import { CheckIcon, InboxIcon } from '../../icons/vue'
import Avatar from '../Avatar/Avatar.vue'
import Button from '../Button/Button.vue'
import IconButton from '../IconButton/IconButton.vue'
import type { NotificationFilter, NotificationInboxLabels, NotificationItem as Item } from '../../internal/motion/notificationInbox'
import styles from './NotificationInbox.module.css'

// The Vue NotificationInbox: the same inbox (NotificationInbox.module.css) as the React one, with unread
// state, mark one or all as read, All and Unread tabs and an empty state. Title and body are plain text here.
export type NotificationItem = Item<string>

const {
  items,
  onMarkRead,
  onMarkAllRead,
  onOpen,
  defaultFilter = 'all',
  now,
  labels: labelsProp,
} = defineProps<{
  /** Notifications, newest first. */
  items: NotificationItem[]
  /** Shows Mark as read on unread rows; emits the id, by its button or by opening the row. Set by listening to mark-read. */
  onMarkRead?: (id: string) => void
  /** Shows "Mark all as read". Set by listening to mark-all-read. */
  onMarkAllRead?: () => void
  /** Makes rows without href buttons; emits the item. Set by listening to open. */
  onOpen?: (item: NotificationItem) => void
  /** Starting filter when there is no v-model:filter. */
  defaultFilter?: NotificationFilter
  /** The time that relative times count from. Undefined uses the clock. */
  now?: Date
  /** Language for times, such as "en-MY". Undefined uses the browser's. */
  locale?: string
  /** Text for tabs, buttons, empty states and screen readers, so you can translate it. */
  labels?: Partial<NotificationInboxLabels>
}>()
/** The selected filter. Use v-model:filter, or leave it out and the inbox keeps its own. */
const model = defineModel<NotificationFilter>('filter')

const defaultLabels: NotificationInboxLabels = {
  filters: 'Filter notifications',
  all: 'All',
  unread: 'Unread',
  unreadItem: 'Unread',
  markRead: 'Mark as read',
  markAllRead: 'Mark all as read',
  empty: 'No notifications yet',
  emptyBody: 'Replies, mentions and updates show up here.',
  emptyUnread: 'You are all caught up',
  emptyUnreadBody: 'Every notification has been read.',
  markedRead: 'Marked as read',
  allMarkedRead: 'All marked as read',
}
const FILTERS: NotificationFilter[] = ['all', 'unread']

const labels = computed(() => ({ ...defaultLabels, ...labelsProp }))
const id = useId()
const local = ref(defaultFilter)
const filter = computed(() => model.value ?? local.value)
const setFilter = (f: NotificationFilter) => {
  local.value = f
  model.value = f
}
const status = ref('')
const tabs = ref<HTMLButtonElement[]>([])
const listEl = ref<HTMLUListElement | null>(null)
let refocus: number | 'tab' | null = null
const unreadCount = computed(() => items.filter((n) => !n.read).length)
const shown = computed(() => (filter.value === 'unread' ? items.filter((n) => !n.read) : items))
const clock = computed(() => (void items, now ?? new Date()))

// A row's button can vanish when it is marked as read, so focus moves to the row in the same place.
onUpdated(() => {
  const target = refocus
  if (target === null) return
  refocus = null
  const rows = listEl.value?.querySelectorAll<HTMLElement>('[data-row-focus]')
  const row = typeof target === 'number' && rows?.length ? rows[Math.min(target, rows.length - 1)] : null
  ;(row ?? tabs.value[FILTERS.indexOf(filter.value)])?.focus()
})

const say = (text: string) => (status.value = status.value === text ? `${text} ` : text)

const markRead = (item: NotificationItem, index: number) => {
  onMarkRead?.(item.id)
  refocus = index
  say(labels.value.markedRead)
}
const markAll = () => {
  onMarkAllRead?.()
  refocus = 'tab'
  say(labels.value.allMarkedRead)
}
const open = (item: NotificationItem) => {
  if (!item.read) onMarkRead?.(item.id)
  onOpen?.(item)
}

const onTabKey = (e: KeyboardEvent) => {
  const i = FILTERS.indexOf(filter.value)
  let next = i
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') next = (i + 1) % FILTERS.length
  else if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = FILTERS.length - 1
  else return
  e.preventDefault()
  setFilter(FILTERS[next])
  tabs.value[next]?.focus()
}
</script>

<template>
  <div :class="styles.root" data-slot="notification-inbox">
    <div :class="styles.toolbar" data-slot="notification-inbox-toolbar">
      <div role="tablist" :aria-label="labels.filters" :class="styles.tabs" data-slot="notification-inbox-filters">
        <button
          v-for="(f, i) in FILTERS"
          :key="f"
          :ref="(el) => (tabs[i] = el as HTMLButtonElement)"
          type="button"
          role="tab"
          :id="`${id}-tab-${f}`"
          :aria-selected="filter === f"
          :aria-controls="`${id}-panel`"
          :tabindex="filter === f ? 0 : -1"
          :class="styles.tab"
          data-slot="notification-inbox-filter"
          :data-state="filter === f ? 'active' : 'inactive'"
          @click="setFilter(f)"
          @keydown="onTabKey"
        >
          {{ f === 'all' ? labels.all : labels.unread }}<span v-if="f === 'unread' && unreadCount > 0" :class="styles.tabCount" data-slot="notification-inbox-count">{{ unreadCount }}</span>
        </button>
      </div>
      <Button v-if="onMarkAllRead && unreadCount > 0" variant="ghost" size="sm" @click="markAll">
        <template #leading><CheckIcon /></template>
        {{ labels.markAllRead }}
      </Button>
    </div>

    <div role="tabpanel" :id="`${id}-panel`" :aria-labelledby="`${id}-tab-${filter}`" :class="styles.panel" data-slot="notification-inbox-panel">
      <ul v-if="shown.length" ref="listEl" :class="styles.list" data-slot="notification-inbox-list">
        <li v-for="(n, i) in shown" :key="n.id" :class="styles.row" data-slot="notification-inbox-item" :data-status="n.read ? 'read' : 'unread'">
          <component
            :is="n.href ? 'a' : onOpen ? 'button' : 'div'"
            :class="styles.main"
            data-slot="notification-inbox-item-main"
            :href="n.href"
            :type="!n.href && onOpen ? 'button' : undefined"
            :data-row-focus="n.href || onOpen ? 'true' : undefined"
            @click="n.href || onOpen ? open(n) : undefined"
          >
            <span :class="styles.dotSlot" :data-avatar="n.actor ? 'true' : undefined">
              <span v-if="!n.read" :class="styles.dot" data-slot="notification-inbox-dot">
                <span :class="styles.sr">{{ labels.unreadItem }}</span>
              </span>
            </span>
            <Avatar v-if="n.actor" :name="n.actor.name" :src="n.actor.avatar" size="sm" />
            <span :class="styles.text">
              <span :id="`${id}-t-${n.id}`" :class="styles.title" data-slot="notification-inbox-title">{{ n.title }}</span>
              <span v-if="n.body" :class="styles.body" data-slot="notification-inbox-body">{{ n.body }}</span>
              <time v-if="isValidDate(toDate(n.time))" :class="styles.time" data-slot="notification-inbox-time" :datetime="toDate(n.time).toISOString()">{{ relativeTime(toDate(n.time), clock, locale) }}</time>
            </span>
          </component>
          <IconButton
            v-if="!n.read && onMarkRead"
            :class="styles.mark"
            size="sm"
            :label="labels.markRead"
            :aria-describedby="`${id}-t-${n.id}`"
            :data-row-focus="n.href || onOpen ? undefined : 'true'"
            @click="markRead(n, i)"
          >
            <template #icon><CheckIcon /></template>
          </IconButton>
        </li>
      </ul>
      <div v-else :class="styles.empty" data-slot="notification-inbox-empty">
        <span :class="styles.emptyIcon" aria-hidden="true"><InboxIcon /></span>
        <p :class="styles.emptyTitle">{{ filter === 'unread' ? labels.emptyUnread : labels.empty }}</p>
        <p :class="styles.emptyBody">{{ filter === 'unread' ? labels.emptyUnreadBody : labels.emptyBody }}</p>
      </div>
    </div>
    <span :class="styles.sr" aria-live="polite">{{ status }}</span>
  </div>
</template>
