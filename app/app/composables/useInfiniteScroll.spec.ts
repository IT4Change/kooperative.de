import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, ref, nextTick } from 'vue'

import { useInfiniteScroll } from './useInfiniteScroll'

/**
 * IntersectionObserver is stubbed rather than driven for real: happy-dom has no
 * layout, so nothing would ever intersect. The point here is the wiring —
 * observe the right element, tear the observer down again, and survive a
 * browser that has no IntersectionObserver at all.
 */
interface FakeObserver {
  callback: IntersectionObserverCallback
  options: IntersectionObserverInit | undefined
  observed: Element[]
  disconnected: boolean
}

const observers: FakeObserver[] = []
const load = vi.fn<() => void>()
const mounted: { unmount: () => void }[] = []

function installObserver() {
  class Fake {
    callback: IntersectionObserverCallback
    options: IntersectionObserverInit | undefined
    observed: Element[] = []
    disconnected = false

    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.callback = callback
      this.options = options
      observers.push(this)
    }
    observe(el: Element) {
      this.observed.push(el)
    }
    disconnect() {
      this.disconnected = true
    }
    unobserve() {}
    takeRecords() {
      return []
    }
  }
  globalThis.IntersectionObserver = Fake as unknown as typeof IntersectionObserver
}

/** Fires the observer callback as the browser would when the sentinel shows up. */
function intersect(observer: FakeObserver, isIntersecting = true) {
  observer.callback(
    [{ isIntersecting } as IntersectionObserverEntry],
    observer as unknown as IntersectionObserver,
  )
}

/** Host that renders the sentinel only while `show` is true, like `v-if="hasMore"`. */
function mountHost(rootMargin?: string) {
  const show = ref(true)
  const wrapper = mount(
    defineComponent({
      setup() {
        const sentinel = ref<HTMLElement>()
        if (rootMargin == null) useInfiniteScroll(sentinel, load)
        else useInfiniteScroll(sentinel, load, rootMargin)
        return () => (show.value ? h('div', { ref: sentinel, id: 'sentinel' }) : null)
      },
    }),
    { attachTo: document.body },
  )
  mounted.push(wrapper)
  return { wrapper, show }
}

describe('useInfiniteScroll', () => {
  beforeEach(() => {
    observers.length = 0
    load.mockClear()
    installObserver()
  })

  afterEach(() => {
    while (mounted.length > 0) mounted.pop()?.unmount()
    document.body.innerHTML = ''
  })

  it('observes the sentinel once it exists', async () => {
    mountHost()
    await nextTick()

    expect(observers).toHaveLength(1)
    expect(observers[0].observed.map((el) => el.id)).toStrictEqual(['sentinel'])
  })

  it('loads when the sentinel comes into view', async () => {
    mountHost()
    await nextTick()

    intersect(observers[0])
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('does not load while the sentinel stays out of view', async () => {
    mountHost()
    await nextTick()

    intersect(observers[0], false)
    expect(load).not.toHaveBeenCalled()
  })

  it('starts loading before the sentinel is actually reached', async () => {
    mountHost()
    await nextTick()

    expect(observers[0].options?.rootMargin).toBe('600px')
  })

  it('accepts a custom margin', async () => {
    mountHost('50px')
    await nextTick()

    expect(observers[0].options?.rootMargin).toBe('50px')
  })

  it('tears the observer down when there is nothing left to load', async () => {
    const { show } = mountHost()
    await nextTick()

    show.value = false
    await nextTick()

    expect(observers[0].disconnected).toBe(true)
    // No replacement observer for a sentinel that no longer exists.
    expect(observers).toHaveLength(1)
  })

  it('re-observes a sentinel that comes back', async () => {
    const { show } = mountHost()
    await nextTick()

    show.value = false
    await nextTick()
    show.value = true
    await nextTick()

    expect(observers).toHaveLength(2)
    expect(observers[1].observed.map((el) => el.id)).toStrictEqual(['sentinel'])
  })

  it('disconnects when the host goes away', async () => {
    const { wrapper } = mountHost()
    await nextTick()

    wrapper.unmount()
    mounted.pop()
    expect(observers[0].disconnected).toBe(true)
  })

  it('does nothing when the browser has no IntersectionObserver', async () => {
    // @ts-expect-error — deliberately removing the API to take the fallback path
    delete globalThis.IntersectionObserver
    mountHost()
    await nextTick()

    // No crash, no observer — the "Mehr anzeigen" button carries the feature.
    expect(observers).toHaveLength(0)
    expect(load).not.toHaveBeenCalled()
  })
})
