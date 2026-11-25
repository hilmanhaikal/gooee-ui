// Gooee UI, MIT licence. https://gooee.dev
import { placeSubmenu } from './menubar'
import { createTypeahead, logicalKey, menuItems, type KeyLike } from './menuKeys'

// A context menu, the same in every framework: what opens it on its target, where each panel sits, and
// the keys inside a panel and its submenus.

const LONG_PRESS_MS = 500
const MOVE_TOLERANCE = 10
const MARGIN = 8
// The size of the dot the menu grows out of, at the point of the click.
const LIQUID_DOT = 16

type Point = { x: number; y: number }
type MouseLike = { clientX: number; clientY: number; preventDefault(): void }
type PointerLike = { clientX: number; clientY: number; pointerType: string }
type KeyEventLike = KeyLike & { shiftKey: boolean }

/**
 * The target's events: right click, long-press on touch, and Shift F10 or the Menu key. Each calls
 * `openAt` with a viewport point. Feed it the target's events; call `destroy` when it goes.
 */
export function createMenuTarget(target: () => HTMLElement | null, openAt: (x: number, y: number) => void) {
  let press: { x: number; y: number; t: number } | null = null
  let ignoreUntil = 0
  const cancelPress = () => {
    if (press) window.clearTimeout(press.t)
    press = null
  }
  const openFromKeyboard = () => {
    const r = target()?.getBoundingClientRect()
    if (r) openAt(r.left + MARGIN * 2, r.top + Math.min(r.height, MARGIN * 4))
  }
  return {
    contextmenu(e: MouseLike) {
      e.preventDefault()
      if (Date.now() < ignoreUntil) return
      cancelPress()
      // Keyboard-made events carry no pointer position, so fall back to the element.
      if (e.clientX === 0 && e.clientY === 0) openFromKeyboard()
      else openAt(e.clientX, e.clientY)
    },
    keydown(e: KeyEventLike) {
      if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
        e.preventDefault()
        ignoreUntil = Date.now() + 400
        openFromKeyboard()
      }
    },
    pointerdown(e: PointerLike) {
      if (e.pointerType !== 'touch') return
      const x = e.clientX
      const y = e.clientY
      cancelPress()
      press = {
        x,
        y,
        t: window.setTimeout(() => {
          press = null
          ignoreUntil = Date.now() + 600
          navigator.vibrate?.(8)
          openAt(x, y)
        }, LONG_PRESS_MS),
      }
    },
    pointermove(e: PointerLike) {
      if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > MOVE_TOLERANCE) cancelPress()
    },
    pointerup: cancelPress,
    destroy: cancelPress,
  }
}

/** Where the menu grows from: a dot where you pressed, or for a submenu, the item that opened it. */
export const menuOrigin = (panel: HTMLElement | null, at: Point | undefined) =>
  at ? new DOMRect(at.x - LIQUID_DOT / 2, at.y - LIQUID_DOT / 2, LIQUID_DOT, LIQUID_DOT) : (panel?.parentElement?.getBoundingClientRect() ?? null)

export type MenuPlace = {
  position: 'fixed' | 'absolute'
  top: number
  left?: number | string
  right?: string
  transformOrigin: string
}

/**
 * The panel's place. The root menu opens at `at`, turned back where it would leave the screen. A
 * submenu opens beside its item on whichever side fits, or, too narrow for either, under it.
 */
export function placeMenu(el: HTMLElement, at: Point | undefined): MenuPlace | null {
  const w = el.offsetWidth
  const h = el.offsetHeight
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (at) {
    const left = at.x + w > vw - MARGIN ? Math.max(MARGIN, at.x - w) : at.x
    const top = at.y + h > vh - MARGIN ? Math.max(MARGIN, at.y - h) : at.y
    return { position: 'fixed', left, top, transformOrigin: `${at.x - left}px ${at.y - top}px` }
  }
  return placeSubmenu(el)
}

/** This panel's own items, not those of a submenu inside it. */
export const ownItems = (panel: HTMLElement | null) => menuItems(panel).filter((el) => el.closest('[role="menu"]') === panel)

type NestedKeyLike = KeyLike & { stopPropagation(): void }

/**
 * A panel's keys: arrows, Home, End and type-ahead (motion/menuKeys.ts). In a submenu, Left or Esc
 * closes just it (`onBack`). Tab closes the whole menu (`onClose`). Each key it uses stops there, so
 * the menu around it does not act on it too.
 */
export function createPanelKeys(panel: () => HTMLElement | null, { submenu, onBack, onClose }: { submenu: () => boolean; onBack: () => void; onClose: () => void }) {
  const typeahead = createTypeahead()
  return (e: NestedKeyLike) => {
    const list = ownItems(panel())
    const current = document.activeElement as HTMLElement
    if (!list.includes(current)) return
    const i = list.indexOf(current)
    const go = (n: number) => {
      e.preventDefault()
      e.stopPropagation()
      list[(n + list.length) % list.length]?.focus()
    }
    if (e.key === 'ArrowDown') go(i + 1)
    else if (e.key === 'ArrowUp') go(i - 1)
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(list.length - 1)
    else if ((logicalKey(e.key, panel()) === 'ArrowLeft' || e.key === 'Escape') && submenu()) {
      // Only this submenu closes; the parent menu stays open.
      e.preventDefault()
      e.stopPropagation()
      onBack()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      onClose()
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      e.stopPropagation()
      typeahead(e.key, list, i)
    }
  }
}
