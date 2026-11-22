// NotificationInbox's items and text, shared by React and Vue.

export type NotificationItem<Content = unknown> = {
  id: string
  /** Main line, such as "Design lead replied to your comment". */
  title: Content
  /** Second line with more detail. */
  body?: Content
  time: Date | string | number
  read?: boolean
  /** Who did it. Shows their avatar. */
  actor?: { name: string; avatar?: string }
  /** Makes the row a link. */
  href?: string
}

export type NotificationFilter = 'all' | 'unread'

export type NotificationInboxLabels = {
  /** Name of the filter tabs. */
  filters: string
  all: string
  unread: string
  /** Spoken on each unread row, next to the dot. */
  unreadItem: string
  markRead: string
  markAllRead: string
  empty: string
  emptyBody: string
  emptyUnread: string
  emptyUnreadBody: string
  /** Spoken after a row is marked as read. */
  markedRead: string
  allMarkedRead: string
}

export type NotificationBellLabels = {
  bell: string
  /** {count} is filled in. */
  unread: string
}
