import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, ref, nextTick } from 'vue'

import { useModal } from './useModal'

/**
 * The focus trap is the kind of code that looks obviously right and then is not,
 * so it gets exercised directly here. The E2E suite proves it works in the real
 * shop; these tests pin the branches (wrap forwards, wrap backwards, focus
 * escaped the panel, dialog without any focusable control).
 */
const close = vi.fn<() => void>()

/**
 * The composable registers its keydown listener on `document`, so a host left
 * mounted would keep listening into the next test. Track and tear them down.
 */
const mounted: { unmount: () => void }[] = []

/** A host component that renders the given buttons inside the "dialog" panel. */
function mountHost(buttons: string[]) {
  const isOpen = ref(false)
  const wrapper = mount(
    defineComponent({
      setup() {
        const panel = ref<HTMLElement>()
        useModal(isOpen, panel, close)
        return () =>
          h('div', [
            h('button', { id: 'outside' }, 'outside'),
            isOpen.value
              ? h('div', { ref: panel, tabindex: '-1', id: 'panel' }, [
                  ...buttons.map((label) => h('button', { id: label }, label)),
                ])
              : null,
          ])
      },
    }),
    { attachTo: document.body },
  )
  mounted.push(wrapper)
  return { wrapper, isOpen }
}

const active = () => document.activeElement?.id

async function press(key: string, shiftKey = false) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, cancelable: true }))
  await nextTick()
}

describe('useModal', () => {
  beforeEach(() => {
    close.mockClear()
  })

  afterEach(() => {
    while (mounted.length > 0) mounted.pop()?.unmount()
    document.body.innerHTML = ''
  })

  it('moves focus to the first control when it opens', async () => {
    const { isOpen } = mountHost(['first', 'second'])
    isOpen.value = true
    await nextTick()
    await nextTick()
    expect(active()).toBe('first')
  })

  it('falls back to the panel itself when there is nothing to focus', async () => {
    const { isOpen } = mountHost([])
    isOpen.value = true
    await nextTick()
    await nextTick()
    expect(active()).toBe('panel')
  })

  it('returns focus to the previously focused element on close', async () => {
    const { isOpen } = mountHost(['first'])
    document.getElementById('outside')!.focus()
    expect(active()).toBe('outside')

    isOpen.value = true
    await nextTick()
    await nextTick()
    expect(active()).toBe('first')

    isOpen.value = false
    await nextTick()
    expect(active()).toBe('outside')
  })

  it('closes on Escape', async () => {
    const { isOpen } = mountHost(['first'])
    isOpen.value = true
    await nextTick()
    await nextTick()

    await press('Escape')
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('ignores keys while closed', async () => {
    mountHost(['first'])
    await press('Escape')
    expect(close).not.toHaveBeenCalled()
  })

  it('wraps Tab from the last control back to the first', async () => {
    const { isOpen } = mountHost(['first', 'second'])
    isOpen.value = true
    await nextTick()
    await nextTick()

    document.getElementById('second')!.focus()
    await press('Tab')
    expect(active()).toBe('first')
  })

  it('wraps Shift+Tab from the first control to the last', async () => {
    const { isOpen } = mountHost(['first', 'second'])
    isOpen.value = true
    await nextTick()
    await nextTick()

    document.getElementById('first')!.focus()
    await press('Tab', true)
    expect(active()).toBe('second')
  })

  it('pulls focus back in when it escaped the panel', async () => {
    const { isOpen } = mountHost(['first', 'second'])
    isOpen.value = true
    await nextTick()
    await nextTick()

    document.getElementById('outside')!.focus()
    await press('Tab', true)
    expect(active()).toBe('second')
  })

  it('leaves Tab alone in the middle of the dialog', async () => {
    const { isOpen } = mountHost(['first', 'second', 'third'])
    isOpen.value = true
    await nextTick()
    await nextTick()

    document.getElementById('second')!.focus()
    await press('Tab')
    // The browser handles the ordinary step; the composable must not interfere.
    expect(active()).toBe('second')
  })

  it('does nothing on Tab in a dialog whose panel is not mounted yet', async () => {
    // The ref is only filled once the panel renders; a Tab arriving in that gap
    // must not throw.
    const isOpen = ref(false)
    const wrapper = mount(
      defineComponent({
        setup() {
          const panel = ref<HTMLElement>()
          useModal(isOpen, panel, close)
          return () => h('button', { id: 'outside' }, 'outside')
        },
      }),
      { attachTo: document.body },
    )
    mounted.push(wrapper)
    isOpen.value = true
    await nextTick()

    await press('Tab')

    expect(close).not.toHaveBeenCalled()
  })

  it('keeps a hidden but focused control in the cycle', async () => {
    // A control counts as focusable when it is laid out *or* currently focused.
    // The second half matters for a control a transition has already taken out
    // of the layout while the focus is still on it — without it the trap would
    // find nothing and let the focus escape the dialog.
    const { isOpen } = mountHost(['first', 'second'])
    isOpen.value = true
    await nextTick()
    await nextTick()
    for (const id of ['first', 'second']) {
      Object.defineProperty(document.getElementById(id)!, 'offsetParent', {
        value: null,
        configurable: true,
      })
    }

    document.getElementById('second')!.focus()
    await press('Tab')

    // Only the focused control is left in the cycle, so Tab stays on it.
    expect(active()).toBe('second')
  })

  it('does nothing on Tab in a dialog without a single focusable control', async () => {
    const { isOpen } = mountHost([])
    isOpen.value = true
    await nextTick()

    await press('Tab')

    // The panel itself holds the focus; there is nothing to cycle through.
    expect(active()).toBe('panel')
  })

  it('ignores unrelated keys', async () => {
    const { isOpen } = mountHost(['first'])
    isOpen.value = true
    await nextTick()
    await nextTick()

    await press('Enter')
    expect(close).not.toHaveBeenCalled()
    expect(active()).toBe('first')
  })

  it('stops listening once the host is unmounted', async () => {
    const { wrapper, isOpen } = mountHost(['first'])
    isOpen.value = true
    await nextTick()
    await nextTick()

    wrapper.unmount()
    mounted.pop()
    await press('Escape')
    expect(close).not.toHaveBeenCalled()
  })
})

describe('useModal with stacked dialogs', () => {
  /** A dialog with its own close spy, so two of them can be told apart. */
  function mountDialog(name: string) {
    const isOpen = ref(false)
    const closeIt = vi.fn<() => void>()
    const wrapper = mount(
      defineComponent({
        setup() {
          const panel = ref<HTMLElement>()
          useModal(isOpen, panel, closeIt)
          return () =>
            isOpen.value
              ? h('div', { ref: panel, tabindex: '-1', id: name }, [
                  h('button', { id: `${name}-a` }, 'a'),
                  h('button', { id: `${name}-b` }, 'b'),
                ])
              : null
        },
      }),
      { attachTo: document.body },
    )
    mounted.push(wrapper)
    return { isOpen, closeIt, wrapper }
  }

  afterEach(() => {
    while (mounted.length > 0) mounted.pop()?.unmount()
    document.body.innerHTML = ''
  })

  it('lets only the dialog in front react to Escape', async () => {
    const back = mountDialog('back')
    const front = mountDialog('front')
    back.isOpen.value = true
    await nextTick()
    front.isOpen.value = true
    await nextTick()

    await press('Escape')

    expect(front.closeIt).toHaveBeenCalledTimes(1)
    expect(back.closeIt).not.toHaveBeenCalled()
  })

  it('hands the keyboard back once the front dialog closes', async () => {
    const back = mountDialog('back')
    const front = mountDialog('front')
    back.isOpen.value = true
    await nextTick()
    front.isOpen.value = true
    await nextTick()
    front.isOpen.value = false
    await nextTick()

    await press('Escape')

    expect(back.closeIt).toHaveBeenCalledTimes(1)
  })

  it('traps Tab only in the front dialog', async () => {
    const back = mountDialog('back')
    const front = mountDialog('front')
    back.isOpen.value = true
    await nextTick()
    front.isOpen.value = true
    await nextTick()
    await nextTick()
    document.getElementById('front-b')!.focus()

    await press('Tab')

    expect(active()).toBe('front-a')
  })

  it('forgets a dialog that is unmounted while open', async () => {
    const back = mountDialog('back')
    const front = mountDialog('front')
    back.isOpen.value = true
    await nextTick()
    front.isOpen.value = true
    await nextTick()

    front.wrapper.unmount()
    await press('Escape')

    expect(back.closeIt).toHaveBeenCalledTimes(1)
  })
})
