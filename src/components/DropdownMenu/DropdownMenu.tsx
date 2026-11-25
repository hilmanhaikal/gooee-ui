'use client'

import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react'
import { CheckIcon, ChevronRightIcon } from '../../icons/icons'
import { useDismiss } from '../../internal/layers'
import { useLiquid } from '../../internal/liquid'
import { useBead } from '../../internal/liquidMore'
import { mergeRefs } from '../../internal/mergeRefs'
import { createPanelKeys, ownItems } from '../../internal/motion/contextMenu'
import { placeSubmenu } from '../../internal/motion/menubar'
import { createMenuKeys, menuButtonKey, menuItems } from '../../internal/motion/menuKeys'
import { menuEntryKey, menuSections } from '../../internal/motion/menuModel'
import { Portal } from '../../internal/Portal'
import { useFloating, type Align } from '../../internal/useFloating'
import { usePresence } from '../../internal/usePresence'
import styles from './DropdownMenu.module.css'

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
      icon?: ReactNode
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

type TriggerProps = {
  id?: string
  ref?: Ref<HTMLElement>
  onClick?: (e: MouseEvent<HTMLElement>) => void
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void
}

export type DropdownMenuProps = {
  /** One button that opens the menu. It gets the menu ARIA attributes, and an id if it has none. */
  trigger: ReactElement<TriggerProps>
  /** Items, checkbox and radio items, submenus, separators and group labels, in menu order. */
  items: DropdownMenuEntry[]
  /** Accessible name for the menu, if the trigger text is not enough. */
  label?: string
  /** Which edge of the trigger the menu lines up with. */
  align?: Align
}

type RowsProps = {
  entries: DropdownMenuEntry[]
  /** Prefix for the ids of group names and disabled reasons. */
  idBase: string
  /** Closes the whole menu; `focusTrigger` puts focus back on the button. */
  close: (focusTrigger?: boolean) => void
}

// The rows of one panel: items, checkable items, groups and submenu triggers. The root menu and each submenu share it.
function Rows({ entries, idBase, close }: RowsProps) {
  const [sub, setSub] = useState<{ index: number; focus: boolean } | null>(null)
  const hoverTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(hoverTimer.current), [])
  // Once any row can be checked, every row keeps the check column, so all the labels line up.
  const hasCheck = entries.some((e) => e.type === 'checkbox' || e.type === 'radio')
  let stagger = 0

  const row = (
    key: string,
    i: number,
    o: {
      role: 'menuitem' | 'menuitemcheckbox' | 'menuitemradio'
      label: string
      icon?: ReactNode
      shortcut?: string
      checked?: boolean
      href?: string
      disabled?: boolean
      reason?: string
      destructive?: boolean
      items?: DropdownMenuEntry[]
      run: () => void
    },
  ) => {
    const n = stagger++
    const hasSub = Boolean(o.items?.length)
    const subOpen = hasSub && sub?.index === i
    const reasonId = o.reason ? `${idBase}-r${key}` : undefined
    const checkable = o.role !== 'menuitem'
    // A click or a key wins over a hover still waiting to act.
    const openSub = () => (window.clearTimeout(hoverTimer.current), setSub({ index: i, focus: true }))
    const choose = (keepOpen: boolean) => {
      window.clearTimeout(hoverTimer.current)
      if (o.disabled) return
      if (hasSub) return openSub()
      if (!keepOpen) close()
      o.run()
    }
    const Tag = o.href && !o.disabled && !hasSub ? 'a' : 'div'
    return (
      <div key={key} role="none" className={styles.itemWrap}>
        <Tag
          href={Tag === 'a' ? o.href : undefined}
          role={o.role}
          tabIndex={-1}
          aria-checked={checkable ? Boolean(o.checked) : undefined}
          aria-disabled={o.disabled || undefined}
          aria-describedby={reasonId}
          aria-haspopup={hasSub ? 'menu' : undefined}
          aria-expanded={hasSub ? subOpen : undefined}
          data-slot={hasSub ? 'dropdown-menu-sub-trigger' : 'dropdown-menu-item'}
          data-state={hasSub ? (subOpen ? 'open' : 'closed') : undefined}
          className={styles.item}
          data-disabled={o.disabled || undefined}
          data-destructive={o.destructive || undefined}
          style={{ ['--i' as string]: Math.min(n, 12) }}
          onPointerEnter={() => {
            window.clearTimeout(hoverTimer.current)
            if (o.disabled) return
            // A short wait, so passing over an item on the way to a submenu does not swap it.
            hoverTimer.current = window.setTimeout(() => setSub(hasSub ? { index: i, focus: false } : null), 120)
          }}
          onPointerMove={(e) => {
            if (!o.disabled && document.activeElement !== e.currentTarget) e.currentTarget.focus()
          }}
          onClick={() => choose(false)}
          onKeyDown={(e) => {
            if (o.disabled) return
            // Enter on a link follows it the browser's way, so a modifier can open it in a new tab.
            if (Tag === 'a' && e.key === 'Enter') return
            menuEntryKey(e, { openSub: hasSub ? openSub : undefined, run: (keep) => (Tag === 'a' ? e.currentTarget.click() : choose(keep)), checkable })
          }}
        >
          {hasCheck && (
            <span data-slot="dropdown-menu-item-indicator" className={styles.check} aria-hidden="true">
              {checkable && o.checked && (o.role === 'menuitemradio' ? <span className={styles.dot} /> : <CheckIcon />)}
            </span>
          )}
          {o.icon && <span data-slot="dropdown-menu-item-icon" className={styles.icon}>{o.icon}</span>}
          <span data-slot="dropdown-menu-item-label" className={styles.label}>
            {o.label}
            {o.reason && (
              <span id={reasonId} data-slot="dropdown-menu-item-reason" className={styles.reason}>
                {o.reason}
              </span>
            )}
          </span>
          {o.shortcut && <kbd data-slot="dropdown-menu-shortcut" className={styles.shortcut}>{o.shortcut}</kbd>}
          {hasSub && <ChevronRightIcon data-slot="dropdown-menu-sub-icon" className={styles.chevron} />}
        </Tag>
        {subOpen && (
          <SubPanel
            entries={o.items!}
            label={o.label}
            focus={sub!.focus}
            idBase={`${idBase}-${i}`}
            close={close}
            onBack={(parent) => {
              setSub(null)
              parent?.focus()
            }}
          />
        )}
      </div>
    )
  }

  const item = (i: number) => {
    const e = entries[i]
    if (e.type === 'checkbox') return row(String(i), i, { role: 'menuitemcheckbox', label: e.label, shortcut: e.shortcut, checked: e.checked, disabled: e.disabled, run: () => e.onCheckedChange(!e.checked) })
    if (e.type === undefined || e.type === 'item')
      return row(String(i), i, {
        role: 'menuitem',
        label: e.label,
        icon: e.icon,
        shortcut: e.shortcut,
        href: e.href,
        disabled: e.disabled,
        reason: e.disabled ? e.disabledReason : undefined,
        destructive: e.destructive,
        items: e.items,
        run: () => e.onSelect?.(),
      })
    return null
  }

  return menuSections(entries).map((section) => {
    const head = entries[section.at]
    if (head.type === 'separator') return <div key={section.at} role="separator" data-slot="dropdown-menu-separator" className={styles.separator} />
    const groupId = `${idBase}-g${section.at}`
    if (head.type === 'radio')
      return (
        <div key={section.at} role="group" aria-labelledby={head.label ? groupId : undefined} data-slot="dropdown-menu-group">
          {head.label && (
            <div id={groupId} role="presentation" data-slot="dropdown-menu-label" className={styles.groupLabel}>
              {head.label}
            </div>
          )}
          {head.options.map((opt) =>
            row(`${section.at}-${opt.value}`, section.at, {
              role: 'menuitemradio',
              label: opt.label,
              shortcut: opt.shortcut,
              checked: opt.value === head.value,
              disabled: opt.disabled,
              run: () => head.onValueChange(opt.value),
            }),
          )}
        </div>
      )
    const rows = section.rows.map(item)
    if (head.type !== 'label') return rows
    // A label names the items under it, so a screen reader says "Sort, group" before the first one.
    return (
      <div key={section.at} role="group" aria-labelledby={groupId} data-slot="dropdown-menu-group">
        <div id={groupId} role="presentation" data-slot="dropdown-menu-label" className={styles.groupLabel}>
          {head.label}
        </div>
        {rows}
      </div>
    )
  })
}

// A submenu opens beside its item, and only takes focus when opened by keyboard or click, so hovering does not steal it.
function SubPanel({
  entries,
  label,
  focus,
  idBase,
  close,
  onBack,
}: {
  entries: DropdownMenuEntry[]
  label: string
  focus: boolean
  idBase: string
  close: RowsProps['close']
  onBack: (parentItem: HTMLElement | null) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<CSSProperties | null>(null)
  useBead(ref, true, styles.bead)

  useLayoutEffect(() => {
    // The parent menu may still be growing open, and its outline would clip this submenu: finish it at once.
    ref.current?.parentElement?.closest('[role="menu"]')?.getAnimations().forEach((a) => a.finish())
    const place = placeSubmenu(ref.current)
    if (place) setPos(place)
  }, [])

  useEffect(() => {
    if (pos && focus) ownItems(ref.current)[0]?.focus({ preventScroll: true })
  }, [pos === null, focus])

  const latest = useRef({ close, onBack })
  latest.current = { close, onBack }
  const keys = useRef<ReturnType<typeof createPanelKeys>>(null)
  keys.current ??= createPanelKeys(() => ref.current, {
    submenu: () => true,
    onBack: () => latest.current.onBack(ref.current?.parentElement?.querySelector<HTMLElement>(':scope > [role="menuitem"]') ?? null),
    onClose: () => latest.current.close(),
  })

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      data-slot="dropdown-menu-sub-content"
      className={styles.menu}
      data-sub=""
      style={pos ?? { position: 'absolute', top: 0, left: 0, opacity: 0, pointerEvents: 'none' }}
      onKeyDown={keys.current}
    >
      <Rows entries={entries} idBase={idBase} close={close} />
    </div>
  )
}

export function DropdownMenu({ trigger, items, label, align = 'start' }: DropdownMenuProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [focusAt, setFocusAt] = useState<'first' | 'last'>('first')
  const anchorRef = useRef<HTMLElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const { mounted, state } = usePresence(open, 'morph-out')
  const floating = useFloating(anchorRef, menuRef, { open: mounted, side: 'bottom', align, offset: 6 })
  // The menu grows out of its button and folds back into it.
  useLiquid(menuRef, anchorRef, state, mounted && floating.ready)
  // The hover fill is a bead that follows the pointer from item to item.
  useBead(menuRef, mounted, styles.bead)

  const close = (focusTrigger = true) => {
    setOpen(false)
    if (focusTrigger) anchorRef.current?.focus()
  }
  useDismiss(open, [anchorRef, menuRef], (reason) => close(reason === 'escape'))

  useEffect(() => {
    if (!open) return
    const list = menuItems(menuRef.current)
    ;(focusAt === 'first' ? list[0] : list[list.length - 1])?.focus({ preventScroll: true })
  }, [open, focusAt])

  const openMenu = (at: 'first' | 'last') => {
    setFocusAt(at)
    setOpen(true)
  }

  // Arrows, Home, End, type-ahead and Tab (motion/menuKeys.ts).
  const closeRef = useRef(close)
  closeRef.current = close
  const keys = useRef<ReturnType<typeof createMenuKeys>>(null)
  keys.current ??= createMenuKeys(() => menuRef.current, () => closeRef.current())

  if (!isValidElement(trigger)) return null
  const tp = trigger.props
  // A caller's id on the trigger wins, so their own labels and tests keep working.
  const triggerId = tp.id ?? `${id}-trigger`

  return (
    <>
      {cloneElement(trigger, {
        ref: mergeRefs(anchorRef, tp.ref),
        id: triggerId,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': open ? id : undefined,
        onClick: (e: MouseEvent<HTMLElement>) => {
          tp.onClick?.(e)
          if (open) close()
          else openMenu('first')
        },
        onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
          tp.onKeyDown?.(e)
          const at = menuButtonKey(e)
          if (at) openMenu(at)
        },
      } as TriggerProps)}
      {mounted && (
        <Portal>
          <div
            ref={menuRef}
            id={id}
            role="menu"
            aria-label={label}
            aria-labelledby={label ? undefined : triggerId}
            data-slot="dropdown-menu-content"
            className={styles.menu}
            data-state={state}
            data-side={floating.side}
            style={floating.style}
            onKeyDown={keys.current}
          >
            <Rows entries={items} idBase={id} close={close} />
          </div>
        </Portal>
      )}
    </>
  )
}
