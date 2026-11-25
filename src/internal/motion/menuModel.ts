import { logicalKey } from './menuKeys'

// What the entries of DropdownMenu, ContextMenu and Menubar mean, the same in every framework.

/**
 * Splits a menu's entries into sections. A separator is a section of its own. A label and the entries after
 * it are one section, a group the label names. A radio entry is its own group. Entries before any label run
 * together as plain rows.
 */
export function menuSections(entries: Array<{ type?: string }>) {
  const out: Array<{ at: number; rows: number[] }> = []
  entries.forEach((entry, i) => {
    const last = out[out.length - 1]
    const kind = last && entries[last.at].type
    if (entry.type === 'separator' || entry.type === 'label') out.push({ at: i, rows: [] })
    else if (entry.type === 'radio') out.push({ at: i, rows: [i] })
    else if (last && kind !== 'separator' && kind !== 'radio') last.rows.push(i)
    else out.push({ at: i, rows: [i] })
  })
  return out
}

/** An item's keys. With a submenu, Right (Left on a right-to-left page), Enter or Space open it. Without, Enter
 * runs the item and closes the menu; Space does the same, but keeps the menu open on a checkable item. */
export function menuEntryKey(
  e: { key: string; currentTarget: EventTarget | null; preventDefault(): void; stopPropagation(): void },
  o: { openSub?: () => void; run: (keepOpen: boolean) => void; checkable: boolean },
) {
  if (o.openSub && (logicalKey(e.key, e.currentTarget as Element | null) === 'ArrowRight' || e.key === 'Enter' || e.key === ' ')) o.openSub()
  else if (e.key === 'Enter') o.run(false)
  else if (e.key === ' ') o.run(o.checkable)
  else return
  e.preventDefault()
  e.stopPropagation()
}
