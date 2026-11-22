'use client'

import { useEffect, useId, useRef, useState, type ComponentPropsWithRef, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from '../../internal/cx'
import { BellIcon, CheckIcon, InboxIcon } from '../../icons/icons'
import type { NotificationBellLabels, NotificationFilter, NotificationInboxLabels, NotificationItem as Item } from '../../internal/motion/notificationInbox'
import { isValidDate, relativeTime, toDate } from '../../internal/relativeTime'
import { useControllable } from '../../internal/useControllable'
import { Avatar } from '../Avatar'
import { Badge } from '../Badge'
import { Button } from '../Button'
import { IconButton } from '../IconButton'
import styles from './NotificationInbox.module.css'

export type NotificationItem = Item<ReactNode>

export type { NotificationBellLabels, NotificationFilter, NotificationInboxLabels }

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

export type NotificationInboxProps = {
  /** Notifications, newest first. */
  items: NotificationItem[]
  /** Called with the id when one is marked as read, by its button or by opening it. */
  onMarkRead?: (id: string) => void
  /** Called by the "Mark all as read" button. Without it the button is hidden. */
  onMarkAllRead?: () => void
  /** Called when a row is opened. Rows without href or onOpen are plain text. */
  onOpen?: (item: NotificationItem) => void
  /** Selected filter, when you control it. */
  filter?: NotificationFilter
  /** Starting filter when you do not control it. */
  defaultFilter?: NotificationFilter
  /** Called when the filter tab changes. */
  onFilterChange?: (filter: NotificationFilter) => void
  /** The time that relative times count from. Undefined uses the clock. */
  now?: Date
  /** Language for times, such as "en-MY". Undefined uses the browser's. */
  locale?: string
  /** Text for tabs, buttons, empty states and screen readers, so you can translate it. */
  labels?: Partial<NotificationInboxLabels>
  /** Extra class for the root element. */
  className?: string
}

const FILTERS: NotificationFilter[] = ['all', 'unread']

export function NotificationInbox({
  items,
  onMarkRead,
  onMarkAllRead,
  onOpen,
  filter: filterProp,
  defaultFilter = 'all',
  onFilterChange,
  now,
  locale,
  labels: labelsProp,
  className,
}: NotificationInboxProps) {
  const labels = { ...defaultLabels, ...labelsProp }
  const id = useId()
  const [filter, setFilter] = useControllable(filterProp, defaultFilter, onFilterChange)
  const [status, setStatus] = useState('')
  const tabs = useRef<Array<HTMLButtonElement | null>>([])
  const listRef = useRef<HTMLUListElement>(null)
  const refocus = useRef<number | 'tab' | null>(null)
  const unreadCount = items.filter((n) => !n.read).length
  const shown = filter === 'unread' ? items.filter((n) => !n.read) : items
  const clock = now ?? new Date()

  // A row's button can vanish when it is marked as read, so focus moves to the row in the same place.
  useEffect(() => {
    const target = refocus.current
    if (target === null) return
    refocus.current = null
    const rows = listRef.current?.querySelectorAll<HTMLElement>('[data-row-focus]')
    const row = typeof target === 'number' && rows?.length ? rows[Math.min(target, rows.length - 1)] : null
    ;(row ?? tabs.current[FILTERS.indexOf(filter)])?.focus()
  })

  const say = (text: string) => setStatus((prev) => (prev === text ? `${text} ` : text))

  const markRead = (item: NotificationItem, index: number) => {
    onMarkRead?.(item.id)
    refocus.current = index
    say(labels.markedRead)
  }

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = FILTERS.indexOf(filter)
    let next = i
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') next = (i + 1) % FILTERS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = FILTERS.length - 1
    else return
    e.preventDefault()
    setFilter(FILTERS[next])
    tabs.current[next]?.focus()
  }

  return (
    <div className={cx(styles.root, className)} data-slot="notification-inbox">
      <div className={styles.toolbar} data-slot="notification-inbox-toolbar">
        <div role="tablist" aria-label={labels.filters} className={styles.tabs} data-slot="notification-inbox-filters">
          {FILTERS.map((f, i) => (
            <button
              key={f}
              ref={(el) => {
                tabs.current[i] = el
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${f}`}
              aria-selected={filter === f}
              aria-controls={`${id}-panel`}
              tabIndex={filter === f ? 0 : -1}
              className={styles.tab}
              data-slot="notification-inbox-filter"
              data-state={filter === f ? 'active' : 'inactive'}
              onClick={() => setFilter(f)}
              onKeyDown={onTabKey}
            >
              {f === 'all' ? labels.all : labels.unread}
              {f === 'unread' && unreadCount > 0 && <span className={styles.tabCount} data-slot="notification-inbox-count">{unreadCount}</span>}
            </button>
          ))}
        </div>
        {onMarkAllRead && unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<CheckIcon />}
            onClick={() => {
              onMarkAllRead()
              refocus.current = 'tab'
              say(labels.allMarkedRead)
            }}
          >
            {labels.markAllRead}
          </Button>
        )}
      </div>

      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${filter}`} className={styles.panel} data-slot="notification-inbox-panel">
        {shown.length ? (
          <ul ref={listRef} className={styles.list} data-slot="notification-inbox-list">
            {shown.map((n, i) => {
              const unread = !n.read
              const titleId = `${id}-t-${n.id}`
              const time = toDate(n.time)
              const content = (
                <>
                  <span className={styles.dotSlot} data-avatar={n.actor ? true : undefined}>
                    {unread && (
                      <span className={styles.dot} data-slot="notification-inbox-dot">
                        <span className={styles.sr}>{labels.unreadItem}</span>
                      </span>
                    )}
                  </span>
                  {n.actor && <Avatar name={n.actor.name} src={n.actor.avatar} size="sm" />}
                  <span className={styles.text}>
                    <span id={titleId} className={styles.title} data-slot="notification-inbox-title">{n.title}</span>
                    {n.body && <span className={styles.body} data-slot="notification-inbox-body">{n.body}</span>}
                    {isValidDate(time) && <time className={styles.time} data-slot="notification-inbox-time" dateTime={time.toISOString()}>{relativeTime(time, clock, locale)}</time>}
                  </span>
                </>
              )
              const open = () => {
                if (unread) onMarkRead?.(n.id)
                onOpen?.(n)
              }
              return (
                <li key={n.id} className={styles.row} data-slot="notification-inbox-item" data-status={unread ? 'unread' : 'read'}>
                  {n.href ? (
                    <a className={styles.main} data-slot="notification-inbox-item-main" href={n.href} data-row-focus onClick={open}>{content}</a>
                  ) : onOpen ? (
                    <button type="button" className={styles.main} data-slot="notification-inbox-item-main" data-row-focus onClick={open}>{content}</button>
                  ) : (
                    <div className={styles.main} data-slot="notification-inbox-item-main">{content}</div>
                  )}
                  {unread && onMarkRead && (
                    <IconButton
                      className={styles.mark}
                      size="sm"
                      label={labels.markRead}
                      aria-describedby={titleId}
                      icon={<CheckIcon />}
                      data-row-focus={n.href || onOpen ? undefined : true}
                      onClick={() => markRead(n, i)}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <div className={styles.empty} data-slot="notification-inbox-empty">
            <span className={styles.emptyIcon} aria-hidden="true"><InboxIcon /></span>
            <p className={styles.emptyTitle}>{filter === 'unread' ? labels.emptyUnread : labels.empty}</p>
            <p className={styles.emptyBody}>{filter === 'unread' ? labels.emptyUnreadBody : labels.emptyBody}</p>
          </div>
        )}
      </div>
      <span className={styles.sr} aria-live="polite">{status}</span>
    </div>
  )
}

export type NotificationBellProps = Omit<ComponentPropsWithRef<'button'>, 'children'> & {
  /** Unread count shown on the badge. 0 hides it. */
  count: number
  /** Counts above this show as "99+". */
  max?: number
  /** Spoken name, so you can translate it. */
  labels?: Partial<NotificationBellLabels>
}

/** A bell button with an unread count. Pass it as a Popover trigger and put a NotificationInbox inside. */
export function NotificationBell({ count, max = 99, labels: labelsProp, className, ...rest }: NotificationBellProps) {
  const labels = { bell: 'Notifications', unread: '{count} unread', ...labelsProp }
  const name = count > 0 ? `${labels.bell}, ${labels.unread.replace('{count}', String(count))}` : labels.bell
  return (
    <IconButton
      {...rest}
      className={cx(styles.bell, className)}
      label={name}
      icon={
        <span className={styles.bellIcon} data-slot="notification-bell">
          <BellIcon />
          {count > 0 && (
            <Badge variant="solid" className={styles.count}>
              {count > max ? `${max}+` : count}
            </Badge>
          )}
        </span>
      }
    />
  )
}
