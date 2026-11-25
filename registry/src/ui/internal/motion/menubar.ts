// Gooee UI, MIT licence. https://gooee.dev
import { focusables } from './focus'
import { logicalKey } from './menuKeys'

// The parts of a menu bar and its menus that are the same in every framework: the keys of the bar and of
// each menu, where a submenu opens, and what an item does when chosen. Toolbar's "More" menu uses them too.

const MARGIN = 8
const ITEM = '[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"]'

/** The items of this menu that focus can land on: not a submenu's, and not disabled ones. */
export const ownMenuItems = (panel: HTMLElement | null) =>
  Array.from(panel?.querySelectorAll<HTMLElement>(ITEM) ?? []).filter((el) => el.closest('[role="menu"]') === panel && el.getAttribute('aria-disabled') !== 'true')

export type SubmenuPlace = { position: 'absolute'; top: number; left?: number | '100%'; right?: '100%'; transformOrigin: string }

/**
 * Where a submenu opens: beside its item on the side the text reads toward (right, or left on a right-to-left
 * page) where there is room, else the other side, else under it, kept inside the screen. Lengths are px.
 */
export function placeSubmenu(el: HTMLElement | null): SubmenuPlace | null {
  const parent = el?.parentElement?.getBoundingClientRect()
  if (!el || !parent) return null
  const w = el.offsetWidth
  const h = el.offsetHeight
  const vw = window.innerWidth
  const vh = window.innerHeight
  const fitsRight = parent.right + w <= vw - MARGIN
  const fitsLeft = parent.left - w >= MARGIN
  if (fitsRight || fitsLeft) {
    const right = getComputedStyle(el).direction === 'rtl' ? !fitsLeft : fitsRight
    const shiftUp = Math.max(0, parent.top + h - (vh - MARGIN))
    return { position: 'absolute', top: -shiftUp, ...(right ? { left: '100%' as const } : { right: '100%' as const }), transformOrigin: right ? 'top left' : 'top right' }
  }
  // Too narrow for either side, as on a phone: open under the item, kept inside the screen.
  const left = Math.max(MARGIN, Math.min(parent.left, vw - MARGIN - w)) - parent.left
  const shiftUp = Math.max(0, parent.bottom + h - (vh - MARGIN))
  return { position: 'absolute', top: parent.height - shiftUp, left, transformOrigin: 'top left' }
}

/** What chosen items need from an entry: the shape is the same in React and Vue, the icon aside. */
export type ChosenEntry =
  | { type: 'checkbox'; checked: boolean; onCheckedChange: (checked: boolean) => void }
  | { type: 'radio'; onValueChange: (value: string) => void }
  | { type?: 'item'; items?: unknown[]; onSelect?: () => void }
  | { type: 'separator' | 'label' }

/**
 * Runs the item `el` stands for. A checkable item keeps the menu open when `keepOpen` is set; an item with
 * a submenu opens it instead of closing.
 */
export function chooseItem(entries: ChosenEntry[], el: HTMLElement, keepOpen: boolean, { onClose, openSub }: { onClose: () => void; openSub: (index: number) => void }) {
  if (el.getAttribute('aria-disabled') === 'true') return
  const i = Number(el.dataset.index)
  const entry = entries[i]
  if (!entry) return
  if (entry.type === 'checkbox') {
    entry.onCheckedChange(!entry.checked)
    if (!keepOpen) onClose()
  } else if (entry.type === 'radio') {
    entry.onValueChange(el.dataset.value ?? '')
    if (!keepOpen) onClose()
  } else if (entry.type === undefined || entry.type === 'item') {
    if (entry.items?.length) return openSub(i)
    onClose()
    entry.onSelect?.()
  }
}

type PanelKey = { key: string; shiftKey: boolean; preventDefault(): void; stopPropagation(): void }

export type MenuPanelHandlers = {
  sub?: boolean
  onClose: (focusTrigger?: boolean) => void
  onLeft?: () => void
  onRight?: () => void
  onBack?: () => void
  onTab?: (shift: boolean) => void
}

export type MenuPanelKeys = {
  panel: () => HTMLElement | null
  /** Runs the focused item; `keepOpen` is set for Space on a checkable item. */
  choose: (el: HTMLElement, keepOpen: boolean) => void
  openSub: (index: number) => void
  /** The panel's latest handlers. Left and Right go on to the bar only when it gives them. */
  handlers: () => MenuPanelHandlers
}

/** Arrows, Home, End, Enter, Space, Tab and type-ahead in one menu panel. Returns the key handler. */
export function createMenuPanelKeys(o: MenuPanelKeys) {
  const typeahead = { text: '', at: 0 }
  return (e: PanelKey) => {
    const h = o.handlers()
    const list = ownMenuItems(o.panel())
    const current = document.activeElement as HTMLElement
    if (!list.includes(current)) return
    const i = list.indexOf(current)
    const go = (n: number) => list[(n + list.length) % list.length]?.focus()
    const k = logicalKey(e.key, current)
    let handled = true
    if (k === 'ArrowDown') go(i + 1)
    else if (k === 'ArrowUp') go(i - 1)
    else if (k === 'Home') go(0)
    else if (k === 'End') go(list.length - 1)
    else if (k === 'ArrowRight') {
      if (current.dataset.sub) o.openSub(Number(current.dataset.index))
      else if (h.onRight) h.onRight()
      else handled = false
    } else if (k === 'ArrowLeft') {
      if (h.sub) h.onBack?.()
      else if (h.onLeft) h.onLeft()
      else handled = false
    } else if (k === 'Escape' && h.sub) h.onBack?.()
    else if (k === 'Enter') o.choose(current, false)
    // Space keeps the menu open on a checkable item, so several can be set in a row.
    else if (k === ' ') o.choose(current, current.getAttribute('role') !== 'menuitem')
    else if (k === 'Tab') {
      h.onClose(false)
      h.onTab?.(e.shiftKey)
    } else if (k.length === 1 && /\S/.test(k)) {
      const now = Date.now()
      typeahead.text = now - typeahead.at > 600 ? k.toLowerCase() : typeahead.text + k.toLowerCase()
      typeahead.at = now
      for (let n = 1; n <= list.length; n++) {
        const el = list[(i + n) % list.length]
        if (el.dataset.label?.toLowerCase().startsWith(typeahead.text)) {
          el.focus()
          break
        }
      }
    } else handled = false
    if (handled) {
      e.preventDefault()
      e.stopPropagation()
    }
  }
}

/** The next menu on the bar from `from` in direction `dir`, skipping disabled ones. */
export function stepMenu(menus: Array<{ disabled?: boolean }>, from: number, dir: 1 | -1) {
  let i = from
  for (let n = 0; n < menus.length; n++) {
    i = (i + dir + menus.length) % menus.length
    if (!menus[i].disabled) return i
  }
  return from
}

/** Tab leaves the whole bar, as if the menu had never opened. */
export function tabOutOf(bar: HTMLElement | null, panel: HTMLElement | null, fallback: HTMLElement | null | undefined, shift: boolean) {
  if (!bar) return
  const all = focusables(document.body).filter((el) => el.tabIndex >= 0 && !bar.contains(el) && !panel?.contains(el))
  const before = all.filter((el) => bar.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING)
  const after = all.filter((el) => bar.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
  const target = shift ? before[before.length - 1] : after[0]
  ;(target ?? fallback)?.focus()
}

export type MenubarKeys = {
  menus: () => Array<{ label: string; disabled?: boolean }>
  isOpen: () => boolean
  moveTo: (i: number, keepOpen: boolean) => void
  show: (i: number, focus: 'first' | 'last') => void
}

/** The keys of the bar's own buttons: arrows, Home, End, opening keys and type-ahead. Returns the key handler. */
export function createMenubarKeys({ menus, isOpen, moveTo, show }: MenubarKeys) {
  const typeahead = { text: '', at: 0 }
  return (e: { key: string; target: EventTarget | null; preventDefault(): void }, i: number) => {
    const list = menus()
    const k = logicalKey(e.key, e.target as Element | null)
    const open = isOpen()
    if (k === 'ArrowRight') moveTo(stepMenu(list, i, 1), open)
    else if (k === 'ArrowLeft') moveTo(stepMenu(list, i, -1), open)
    else if (k === 'Home') moveTo(stepMenu(list, -1, 1), open)
    else if (k === 'End') moveTo(stepMenu(list, list.length, -1), open)
    else if (k === 'ArrowDown' || k === 'Enter' || k === ' ') show(i, 'first')
    else if (k === 'ArrowUp') show(i, 'last')
    else if (k.length === 1 && /\S/.test(k)) {
      const now = Date.now()
      typeahead.text = now - typeahead.at > 600 ? k.toLowerCase() : typeahead.text + k.toLowerCase()
      typeahead.at = now
      for (let n = 1; n <= list.length; n++) {
        const j = (i + n) % list.length
        if (!list[j].disabled && list[j].label.toLowerCase().startsWith(typeahead.text)) {
          moveTo(j, false)
          break
        }
      }
    } else return
    e.preventDefault()
  }
}
