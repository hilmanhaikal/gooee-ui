import { watchKeyboard } from '../keyboard'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'

export function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('inert') && el.getClientRects().length > 0,
  )
}

// Safari, on iPhone and on Mac, does not focus a button when it is tapped or clicked. So the control
// that opened a layer is often not the focused element; remember the last one pressed instead.
// Watched from the moment this file loads, since a layer only mounts after the press that opens it.
let lastPressed: HTMLElement | null = null
if (typeof document !== 'undefined') {
  document.addEventListener(
    'pointerdown',
    (e) => {
      lastPressed = (e.target instanceof Element ? e.target.closest<HTMLElement>(FOCUSABLE) : null) ?? null
    },
    true,
  )
  // Focus moved from code stays above a phone keyboard.
  watchKeyboard()
}

// Where focus should go back to: the focused element, unless it is the page or a box around the
// control that was just pressed. Then that control.
export function returnTarget(): HTMLElement | null {
  const active = document.activeElement as HTMLElement | null
  const pressed = lastPressed && lastPressed.isConnected ? lastPressed : null
  if (pressed && (!active || active === document.body || (active !== pressed && active.contains(pressed)))) return pressed
  return active
}

// What stays live behind a modal: toasts (marked data-gooee-layer-ignore) and live regions, so news is still
// read, and the modals' own dim overlays, which can sit beside the panel rather than around it.
const KEEP_LIVE = '[data-gooee-layer-ignore], [aria-live], [role="alert"], [role="status"], [data-slot$="overlay"]'
// A live region inside a control (a button's own status) does not keep the control: it goes inert whole,
// or it would stay reachable with its label taken away.
const CONTROL = 'button, a[href], input, select, textarea, [role="button"], [role="link"], [tabindex]'
// How many open modals hold each element inert, so closing an inner modal keeps the outer one's.
const held = new Map<Element, number>()

/**
 * Makes everything outside the layer that holds `root` inert: no focus, no clicks, hidden from screen
 * readers, so a modal is the whole page while it is open. Returns the undo.
 */
export function inertOutside(root: HTMLElement) {
  // The layer is the body child that holds root, so its own overlay stays live.
  let layer: Element = root
  while (layer.parentElement && layer.parentElement !== document.body) layer = layer.parentElement
  const keep = [layer, ...Array.from(document.querySelectorAll(KEEP_LIVE)).filter((k) => k === layer || !k.parentElement?.closest(CONTROL))]
  const changed: Element[] = []
  const visit = (parent: Element) => {
    for (const el of Array.from(parent.children)) {
      if (/^(SCRIPT|STYLE|TEMPLATE|LINK|META)$/.test(el.tagName) || keep.some((k) => k === el || k.contains(el))) continue
      if (keep.some((k) => el.contains(k))) visit(el)
      else {
        const n = held.get(el) ?? 0
        // Inert the page set on its own is not ours to undo.
        if (n === 0 && el.hasAttribute('inert')) continue
        held.set(el, n + 1)
        el.setAttribute('inert', '')
        changed.push(el)
      }
    }
  }
  visit(document.body)
  return () => {
    for (const el of changed) {
      const n = (held.get(el) ?? 1) - 1
      if (n > 0) held.set(el, n)
      else {
        held.delete(el)
        el.removeAttribute('inert')
      }
    }
  }
}

/**
 * Keeps Tab inside `root` until the returned function is called, starting on `initialFocus` or the first
 * focusable (close buttons opt out with data-skip-initial-focus). On release, focus goes back to where it
 * came from, if it is still inside the layer. With `modal`, the rest of the page is inert meanwhile.
 */
export function trapFocus(root: HTMLElement, { initialFocus, restore = true, modal = false }: { initialFocus?: HTMLElement | null; restore?: boolean; modal?: boolean } = {}) {
  const previous = returnTarget()
  const release = modal ? inertOutside(root) : () => {}
  // Close buttons opt out of first focus, so focus lands on the content or the safe action. With only a close
  // button inside, a panel that can take focus takes it, or the close button would open with a focus ring.
  const list = focusables(root)
  const first = initialFocus ?? list.find((el) => !el.hasAttribute('data-skip-initial-focus')) ?? (root.hasAttribute('tabindex') ? root : list[0]) ?? root
  first.focus({ preventScroll: true })

  // Safari's plain Tab skips buttons, so it can jump from the middle of the layer to the page behind,
  // or off the page. A Tab that lands outside goes back to the end it wrapped past.
  let check = 0
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return
    const items = focusables(root)
    if (items.length === 0) {
      e.preventDefault()
      root.focus()
      return
    }
    const firstEl = items[0]
    const lastEl = items[items.length - 1]
    const current = document.activeElement
    if (e.shiftKey && (current === firstEl || current === root)) {
      e.preventDefault()
      lastEl.focus()
    } else if (!e.shiftKey && current === lastEl) {
      e.preventDefault()
      firstEl.focus()
    } else {
      const back = e.shiftKey
      clearTimeout(check)
      check = window.setTimeout(() => {
        if (root.contains(document.activeElement)) return
        const now = focusables(root)
        now[back ? now.length - 1 : 0]?.focus({ preventScroll: true })
      })
    }
  }
  root.addEventListener('keydown', onKey)
  return () => {
    clearTimeout(check)
    root.removeEventListener('keydown', onKey)
    // The page comes back first, or focus could not return to it.
    release()
    // Give focus back only if it is still in the layer, so a click elsewhere keeps its own focus.
    const now = document.activeElement
    const stillInside = !now || now === document.body || root.contains(now)
    if (restore && stillInside && previous && document.contains(previous)) previous.focus({ preventScroll: true })
  }
}
