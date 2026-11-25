<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { trapFocus } from '../../internal/motion/focus'
import { dismissable, lockScroll } from '../../internal/motion/layers'
import { createDialogMorph } from '../../internal/motion/liquid'
import { motionMs } from '../../internal/motion'
import Button from '../Button/Button.vue'
import dialog from '../Dialog/Dialog.module.css'
import styles from './AlertDialog.module.css'

// The Vue AlertDialog: the same look, morph and focus as the React one.

const {
  title,
  description,
  cancelLabel = 'Cancel',
  tone = 'neutral',
  confirmingLabel,
  onConfirm,
} = defineProps<{
  /** The question, such as "Delete this project?". Also the accessible name. The title slot replaces it. */
  title?: string
  /** What happens if they confirm. Read out with the title when the dialog opens. The description slot replaces it. */
  description?: string
  /** Text of the confirm button. Name the action, such as "Delete project", not "OK". */
  confirmLabel: string
  /** Text of the cancel button. */
  cancelLabel?: string
  /** The confirm button's colour says what it does. "neutral" (the default) is the accent blue of the main action,
   * for a safe step such as "Send now". "danger" is solid red, only for actions that destroy something, such as "Delete". */
  tone?: 'neutral' | 'danger'
  /** They confirmed, before the dialog closes. Listen with @confirm. Return a promise, such as a delete request, and the dialog waits: the button shows a spinner, Cancel and Esc wait too, and it closes once the promise succeeds. If it fails, the dialog stays open, so you can say what went wrong. */
  onConfirm?: () => unknown
  /** Spoken on the confirm button while a promise from @confirm is running, such as "Deleting". */
  confirmingLabel?: string
}>()

/** Shows the dialog. Use v-model:open; Confirm, Cancel or Esc set it false. A tap outside never closes it. */
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{
  /** They cancelled with the button or Esc, before the dialog closes. */
  cancel: []
}>()
const slots = defineSlots<{ default?: () => unknown; title?: () => unknown; description?: () => unknown }>()

const id = useId()
const panel = ref<HTMLElement | null>(null)
const cancelButton = ref<InstanceType<typeof Button> | null>(null)

const pending = ref(false)
const cancel = () => {
  if (pending.value) return
  emit('cancel')
  open.value = false
}
const confirm = () => {
  if (pending.value) return
  const result = onConfirm?.()
  if (!(result instanceof Promise)) return (open.value = false)
  pending.value = true
  result.then(
    () => {
      pending.value = false
      open.value = false
    },
    () => (pending.value = false),
  )
}

const mounted = ref(open.value)
const state = computed(() => (open.value ? 'open' : 'closed'))
let leaving = 0
const morph = createDialogMorph(() => panel.value)

let release: Array<() => void> = []
const stop = () => {
  release.forEach((r) => r())
  release = []
}
const server = typeof window === 'undefined'

// Before the new state renders, so the opener is read while it still has focus.
watch(
  open,
  (now, was) => {
    if (server) return
    clearTimeout(leaving)
    if (now && !was) morph.opening()
    if (now) mounted.value = true
    else leaving = window.setTimeout(() => (mounted.value = false), motionMs('morph-out'))
  },
  { immediate: true, flush: 'pre' },
)

watch(
  [state, mounted],
  async () => {
    if (server || !mounted.value) return
    await nextTick()
    morph.play(state.value)
    stop()
    if (!open.value || !panel.value) return
    const el = panel.value
    // Focus starts on the least destructive choice, so a stray Enter never confirms.
    release.push(
      lockScroll(),
      dismissable(() => [el], cancel, { outside: false }),
      trapFocus(el, { initialFocus: cancelButton.value?.el ?? null, modal: true }),
    )
  },
  { immediate: true, flush: 'post' },
)

onBeforeUnmount(() => {
  clearTimeout(leaving)
  stop()
  morph.destroy()
})
</script>

<template>
  <Teleport v-if="mounted" to="body">
    <div data-slot="alert-dialog-overlay" :class="dialog.overlay" :data-state="state" aria-hidden="true" />
    <div :class="dialog.positioner">
      <div ref="panel" role="alertdialog" aria-modal="true" :aria-labelledby="`${id}-title`" :aria-describedby="`${id}-desc`" tabindex="-1" data-slot="alert-dialog" :class="[dialog.panel, dialog.sm]" :data-state="state">
        <header :class="[dialog.header, styles.header]">
          <div :class="dialog.titles">
            <h2 :id="`${id}-title`" data-slot="alert-dialog-title" :class="dialog.title">
              <slot name="title">{{ title }}</slot>
            </h2>
            <p :id="`${id}-desc`" data-slot="alert-dialog-description" :class="dialog.description">
              <slot name="description">{{ description }}</slot>
            </p>
          </div>
        </header>
        <div v-if="slots.default" data-slot="alert-dialog-body" :class="dialog.body"><slot /></div>
        <footer data-slot="alert-dialog-footer" :class="dialog.footer">
          <Button ref="cancelButton" variant="secondary" :disabled="pending" @click="cancel">{{ cancelLabel }}</Button>
          <Button :variant="tone === 'danger' ? 'danger' : 'primary'" :loading="pending" :loading-label="confirmingLabel" @click="confirm">{{ confirmLabel }}</Button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
