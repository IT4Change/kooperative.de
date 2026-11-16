/**
 * Keyboard and focus behaviour shared by the shop's overlays (cart sidebar,
 * cookie banner, welcome dialog).
 *
 * A `<div>` with a dark backdrop is not a dialog to anyone who cannot see it.
 * The markup side (role="dialog", aria-modal, aria-labelledby) lives in the
 * components; this composable adds the three behaviours that cannot be
 * expressed in markup:
 *
 *   - Escape closes.
 *   - Focus moves into the dialog when it opens, so the next Tab lands inside
 *     instead of somewhere in the page behind it.
 *   - Focus returns to whatever was focused before, so a keyboard user is not
 *     dumped at the top of the document.
 *   - Tab wraps inside the dialog while it is open (focus trap).
 *
 * Dialogs can stack — the legal dialog opens on top of the cart, for instance.
 * Only the topmost open dialog reacts to the keyboard, so Escape closes the
 * one in front instead of all of them at once.
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Open dialogs in the order they opened; the last one is in front. */
const openStack: symbol[] = []

function leaveStack(id: symbol) {
  const index = openStack.indexOf(id)
  if (index !== -1) openStack.splice(index, 1)
}

export function useModal(
  isOpen: Ref<boolean> | ComputedRef<boolean>,
  panel: Ref<HTMLElement | undefined>,
  close: () => void,
) {
  const id = Symbol('modal')
  let previouslyFocused: HTMLElement | null = null

  function focusables(): HTMLElement[] {
    if (!panel.value) return []
    return [...panel.value.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    )
  }

  function onKeydown(event: KeyboardEvent) {
    if (!isOpen.value || openStack.at(-1) !== id) return

    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }

    if (event.key !== 'Tab') return
    const items = focusables()
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement

    // Wrap around, and pull focus back in if it escaped the panel entirely.
    if (event.shiftKey && (active === first || !panel.value?.contains(active))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  watch(isOpen, async (open) => {
    leaveStack(id)
    if (open) {
      openStack.push(id)
      previouslyFocused = document.activeElement as HTMLElement | null
      await nextTick()
      // Prefer the first control; fall back to the panel itself (tabindex="-1"),
      // so the screen reader announces the dialog even when it has no controls.
      ;(focusables()[0] ?? panel.value)?.focus()
    } else {
      previouslyFocused?.focus()
      previouslyFocused = null
    }
  })

  onMounted(() => {
    document.addEventListener('keydown', onKeydown)
  })
  onBeforeUnmount(() => {
    leaveStack(id)
    document.removeEventListener('keydown', onKeydown)
  })
}
