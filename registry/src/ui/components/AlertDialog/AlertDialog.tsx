// Gooee UI, MIT licence. https://gooee.dev
'use client'

import { useId, useRef, useState, type ReactNode } from 'react'
import { cx } from '../../internal/cx'
import { useFocusTrap } from '../../internal/focus'
import { useDismiss, useScrollLock } from '../../internal/layers'
import { useDialogMorph } from '../../internal/liquid'
import { Portal } from '../../internal/Portal'
import { usePresence } from '../../internal/usePresence'
import { Button } from '../Button'
import dialog from '../Dialog/Dialog.module.css'
import styles from './AlertDialog.module.css'

export type AlertDialogProps = {
  /** Shows the dialog. You always control it. */
  open: boolean
  /** Called with false after Confirm, Cancel or Esc. A tap outside never closes it. */
  onOpenChange: (open: boolean) => void
  /** The question, such as "Delete this project?". Also the accessible name. */
  title: ReactNode
  /** What happens if they confirm. Read out with the title when the dialog opens. */
  description: ReactNode
  /** Extra content under the description, such as a list of what goes away. */
  children?: ReactNode
  /** Text of the confirm button. Name the action, such as "Delete project", not "OK". */
  confirmLabel: string
  /** Text of the cancel button. */
  cancelLabel?: string
  /** Called when they confirm, before the dialog closes. Return a promise, such as a delete request, and the dialog waits: the button shows a spinner, Cancel and Esc wait too, and it closes once the promise succeeds. If it fails, the dialog stays open, so you can say what went wrong. */
  onConfirm: () => void | Promise<unknown>
  /** Spoken on the confirm button while a promise from onConfirm is running, such as "Deleting". */
  confirmingLabel?: string
  /** Called when they cancel with the button or Esc, before the dialog closes. */
  onCancel?: () => void
  /** The confirm button's colour says what it does. "neutral" (the default) is the accent blue of the main action,
   * for a safe step such as "Send now". "danger" is solid red, only for actions that destroy something, such as "Delete". */
  tone?: 'neutral' | 'danger'
  /** Extra class for the dialog panel. */
  className?: string
}

export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  confirmingLabel,
  onCancel,
  tone = 'neutral',
  className,
}: AlertDialogProps) {
  const [pending, setPending] = useState(false)
  const id = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const { mounted, state } = usePresence(open, 'morph-out')
  useDialogMorph(panelRef, open, mounted, state)

  const cancel = () => {
    if (pending) return
    onCancel?.()
    onOpenChange(false)
  }
  const confirm = () => {
    if (pending) return
    const result = onConfirm()
    if (!(result instanceof Promise)) return onOpenChange(false)
    setPending(true)
    result.then(
      () => {
        setPending(false)
        onOpenChange(false)
      },
      () => setPending(false),
    )
  }

  useScrollLock(open)
  useDismiss(open, [panelRef], cancel, { outside: false })
  // Focus starts on the least destructive choice, so a stray Enter never confirms.
  useFocusTrap(panelRef, open && mounted, { initialFocus: cancelRef, modal: true })

  if (!mounted) return null
  return (
    <Portal>
      <div data-slot="alert-dialog-overlay" className={dialog.overlay} data-state={state} aria-hidden="true" />
      <div className={dialog.positioner}>
        <div
          ref={panelRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-desc`}
          tabIndex={-1}
          data-slot="alert-dialog"
          className={cx(dialog.panel, dialog.sm, className)}
          data-state={state}
        >
          <header className={cx(dialog.header, styles.header)}>
            <div className={dialog.titles}>
              <h2 id={`${id}-title`} data-slot="alert-dialog-title" className={dialog.title}>{title}</h2>
              <p id={`${id}-desc`} data-slot="alert-dialog-description" className={dialog.description}>{description}</p>
            </div>
          </header>
          {children && <div data-slot="alert-dialog-body" className={dialog.body}>{children}</div>}
          <footer data-slot="alert-dialog-footer" className={dialog.footer}>
            <Button ref={cancelRef} variant="secondary" onClick={cancel} disabled={pending}>
              {cancelLabel}
            </Button>
            <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={confirm} loading={pending} loadingLabel={confirmingLabel}>
              {confirmLabel}
            </Button>
          </footer>
        </div>
      </div>
    </Portal>
  )
}
