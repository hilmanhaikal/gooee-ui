// Gooee UI, MIT licence. https://gooee.dev
'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { cx } from '../../internal/cx'
import { speedMenuKey } from '../../internal/motion/media'
import styles from './SpeedMenu.module.css'

type Props = {
  rates: number[]
  rate: number
  onRate: (rate: number) => void
  /** Name of the button and menu, such as "Playback speed". */
  label: string
  /** Visible rate text, with {rate} filled in. */
  format: string
  tone: 'scrim' | 'surface'
  onOpenChange?: (open: boolean) => void
}

/** Menu button with radio items. It stays inside the player, so it still shows in full screen. */
export function SpeedMenu({ rates, rate, onRate, label, format, tone, onOpenChange }: Props) {
  const id = useId()
  const [open, setOpenState] = useState(false)
  const [active, setActive] = useState(0)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const items = useRef<Array<HTMLButtonElement | null>>([])
  const text = (r: number) => format.replace('{rate}', String(r))

  const setOpen = (next: boolean) => {
    setOpenState(next)
    onOpenChange?.(next)
  }

  const show = (index: number) => {
    setActive(index)
    setOpen(true)
  }

  useEffect(() => {
    if (open) items.current[active]?.focus()
  }, [open, active])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node
      if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  const close = () => {
    setOpen(false)
    buttonRef.current?.focus()
  }

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = speedMenuKey(e.key, active, rates.length)
    if (next === null) return
    if (next === 'tab') return setOpen(false)
    e.preventDefault()
    e.stopPropagation()
    if (next === 'close') close()
    else setActive(next)
  }

  const current = Math.max(0, rates.indexOf(rate))

  return (
    <div className={cx(styles.root, styles[tone])} data-slot="speed-menu">
      <button
        ref={buttonRef}
        type="button"
        className={styles.button}
        data-slot="speed-menu-trigger"
        data-state={open ? 'open' : 'closed'}
        aria-label={`${label}, ${text(rate)}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? setOpen(false) : show(current))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            e.stopPropagation()
            show(e.key === 'ArrowUp' ? rates.length - 1 : current)
          }
        }}
      >
        {text(rate)}
      </button>
      {open && (
        <div ref={menuRef} id={id} role="menu" aria-label={label} className={styles.menu} data-slot="speed-menu-content" onKeyDown={onMenuKey}>
          {rates.map((r, i) => (
            <button
              key={r}
              ref={(el) => {
                items.current[i] = el
              }}
              type="button"
              role="menuitemradio"
              aria-checked={r === rate}
              tabIndex={i === active ? 0 : -1}
              className={styles.item}
              data-slot="speed-menu-item"
              data-state={r === rate ? 'checked' : 'unchecked'}
              onClick={() => {
                onRate(r)
                close()
              }}
            >
              <span className={styles.check} aria-hidden="true" />
              {text(r)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
