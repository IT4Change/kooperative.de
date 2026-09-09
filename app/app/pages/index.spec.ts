import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import IndexPage from './index.vue'

/**
 * The start page. Its substance is the snap scrolling: wheel and touch are
 * intercepted so the page jumps between the two full-height sections instead of
 * scrolling freely, but only while the user is inside them — past the last
 * section the page has to let go, or the footer would be unreachable.
 *
 * happy-dom reports 0 for every geometry, so the two sections get their layout
 * assigned by hand.
 */
const HERO_HEIGHT = 800
const VIEWPORT = 768

let hero: HTMLElement
let uebersicht: HTMLElement

function layout(el: HTMLElement, top: number, height: number) {
  Object.defineProperty(el, 'offsetTop', { value: top, configurable: true })
  Object.defineProperty(el, 'offsetHeight', { value: height, configurable: true })
  vi.spyOn(el, 'scrollIntoView').mockImplementation()
}

function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
}

function wheel(deltaY: number) {
  const event = new WheelEvent('wheel', { deltaY, cancelable: true })
  window.dispatchEvent(event)
  return event
}

function touch(from: number, to: number) {
  window.dispatchEvent(Object.assign(new Event('touchstart'), { touches: [{ clientY: from }] }))
  const move = Object.assign(new Event('touchmove', { cancelable: true }), {
    touches: [{ clientY: to }],
  })
  window.dispatchEvent(move)
  return move
}

let unmount: (() => void) | null = null

async function mountPage() {
  const wrapper = await mountSuspended(IndexPage, { attachTo: document.body })
  unmount = () => {
    wrapper.unmount()
  }
  hero = document.querySelector('section')!
  uebersicht = document.getElementById('uebersicht')!
  layout(hero, 0, HERO_HEIGHT)
  layout(uebersicht, HERO_HEIGHT, HERO_HEIGHT)
  return wrapper
}

beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(window, 'innerHeight', { value: VIEWPORT, configurable: true })
  scrollTo(0)
})

afterEach(() => {
  // Unmount rather than wipe the body: the wheel and touch listeners sit on
  // window, and only the component's own teardown takes them off again.
  unmount?.()
  unmount = null
  vi.useRealTimers()
})

describe('content', () => {
  it('builds the logo source from the app base URL', async () => {
    const wrapper = await mountPage()

    expect(wrapper.get('#hero img').attributes('src')).toBe('/img/logo-schrift-braun.svg')
  })

  it('offers the shop and the four areas', async () => {
    const wrapper = await mountPage()
    const labels = wrapper.findAll('a').map((a) => a.text())

    expect(labels).toStrictEqual(['Bestellung', 'Arbeit', 'Kultur', 'Bildung', 'Gäste'])
  })

  it('points the area buttons at the old site', async () => {
    const wrapper = await mountPage()

    expect(wrapper.get('a[href="https://www.dorf-uni.de/"]').text()).toBe('Bildung')
  })
})

describe('the scroll hint', () => {
  it('jumps to the second section', async () => {
    const wrapper = await mountPage()

    await wrapper.get('button[aria-label="Nach unten scrollen"]').trigger('click')

    expect(uebersicht.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
  })
})

describe('wheel', () => {
  it('snaps down to the next section', async () => {
    await mountPage()

    const event = wheel(120)

    expect(uebersicht.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
    expect(event.defaultPrevented).toBe(true)
  })

  it('ignores further wheeling while the animation runs', async () => {
    await mountPage()
    wheel(120)

    wheel(120)

    // Queuing up jumps would fly past the section the user aimed at.
    expect(uebersicht.scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('accepts the next jump once the animation is over', async () => {
    await mountPage()
    wheel(120)
    vi.advanceTimersByTime(800)

    scrollTo(400)
    wheel(120)

    expect(uebersicht.scrollIntoView).toHaveBeenCalledTimes(2)
  })

  it('snaps back up to the hero', async () => {
    await mountPage()
    scrollTo(400)

    const event = wheel(-120)

    expect(hero.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
    expect(event.defaultPrevented).toBe(true)
  })

  it('leaves upward wheeling alone at the very top', async () => {
    await mountPage()
    scrollTo(0)

    const event = wheel(-120)

    expect(hero.scrollIntoView).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('leaves upward wheeling alone below the hero', async () => {
    // Past the hero the page scrolls normally — the footer lives down there.
    await mountPage()
    scrollTo(HERO_HEIGHT + 100)

    wheel(-120)

    expect(hero.scrollIntoView).not.toHaveBeenCalled()
  })

  it('releases the page at the last section', async () => {
    await mountPage()
    scrollTo(HERO_HEIGHT * 2 - VIEWPORT)

    const event = wheel(120)

    expect(uebersicht.scrollIntoView).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('stops listening once the page is left', async () => {
    const wrapper = await mountPage()

    wrapper.unmount()
    unmount = null
    wheel(120)

    expect(uebersicht.scrollIntoView).not.toHaveBeenCalled()
  })
})

describe('touch', () => {
  it('snaps down on a swipe up', async () => {
    await mountPage()

    const event = touch(500, 400)

    expect(uebersicht.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
    expect(event.defaultPrevented).toBe(true)
  })

  it('snaps back to the hero on a swipe down', async () => {
    await mountPage()
    scrollTo(400)

    const event = touch(400, 500)

    expect(hero.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
    expect(event.defaultPrevented).toBe(true)
  })

  it('ignores a swipe too short to be meant as one', async () => {
    await mountPage()

    touch(500, 480)

    expect(uebersicht.scrollIntoView).not.toHaveBeenCalled()
    expect(hero.scrollIntoView).not.toHaveBeenCalled()
  })

  it('ignores a swipe down at the very top', async () => {
    await mountPage()
    scrollTo(0)

    touch(400, 500)

    expect(hero.scrollIntoView).not.toHaveBeenCalled()
  })

  it('ignores further swiping while the animation runs', async () => {
    await mountPage()
    touch(500, 400)

    touch(500, 400)

    expect(uebersicht.scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('releases the page at the last section', async () => {
    await mountPage()
    scrollTo(HERO_HEIGHT * 2 - VIEWPORT)

    const event = touch(500, 400)

    expect(uebersicht.scrollIntoView).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })
})
