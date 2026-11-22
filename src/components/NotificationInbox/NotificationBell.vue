<script setup lang="ts">
import { computed } from 'vue'
import { BellIcon } from '../../icons/vue'
import Badge from '../Badge/Badge.vue'
import IconButton from '../IconButton/IconButton.vue'
import type { NotificationBellLabels } from '../../internal/motion/notificationInbox'
import styles from './NotificationInbox.module.css'

// The Vue NotificationBell: a bell button with an unread count, like the React one. Put it in a Popover's
// trigger slot with a NotificationInbox inside. Other attributes and listeners go to the button.
const {
  count,
  max = 99,
  labels: labelsProp,
} = defineProps<{
  /** Unread count shown on the badge. 0 hides it. */
  count: number
  /** Counts above this show as "99+". */
  max?: number
  /** Spoken name, so you can translate it. */
  labels?: Partial<NotificationBellLabels>
}>()

const name = computed(() => {
  const labels = { bell: 'Notifications', unread: '{count} unread', ...labelsProp }
  return count > 0 ? `${labels.bell}, ${labels.unread.replace('{count}', String(count))}` : labels.bell
})
</script>

<template>
  <IconButton :class="styles.bell" :label="name">
    <template #icon>
      <span :class="styles.bellIcon" data-slot="notification-bell">
        <BellIcon />
        <Badge v-if="count > 0" variant="solid" :class="styles.count">{{ count > max ? `${max}+` : count }}</Badge>
      </span>
    </template>
  </IconButton>
</template>
