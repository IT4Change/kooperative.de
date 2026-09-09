import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { useConsent } from '../composables/useConsent'
import { useStorage } from '../composables/useStorage'

import DefaultLayout from './default.vue'

/**
 * The public shell: header with the burger menu, the two consent-ish dialogs
 * teleported to <body>, and the footer.
 *
 * The composables behind the dialogs are module singletons, so this file drives
 * them directly instead of mocking — a mock would be a different instance than
 * the one the layout holds.
 */
const CONSENT_KEY = 'kooperative-consent-v1'

// useStorage latches its verdict on the first check, so the flag has to be set
// before anything calls into it.
;(window as unknown as { __storageBlocked: boolean }).__storageBlocked = true

/**
 * happy-dom has no IntersectionObserver, and no layout for one to work on. The
 * fake records what was observed and lets the tests fire entries by hand.
 */
interface FakeObserver {
  callback: IntersectionObserverCallback
  observed: Element[]
  disconnected: boolean
}
const observers: FakeObserver[] = []

class FakeIntersectionObserver {
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

/** happy-dom's scrollY is a getter; the scroll handler reads it on every event. */
function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
  window.dispatchEvent(new Event('scroll'))
}

/** The dialogs are teleported to <body>, so a leftover mount would pollute it. */
let unmount: (() => void) | null = null

beforeEach(() => {
  observers.length = 0
  globalThis.IntersectionObserver =
    FakeIntersectionObserver as unknown as typeof IntersectionObserver
  localStorage.clear()
  useConsent().decline()
  useStorage().dismissWarning()
  scrollTo(0)
  vi.spyOn(window, 'scrollTo').mockImplementation()
})

afterEach(() => {
  unmount?.()
  unmount = null
})

async function mount(route = '/') {
  const wrapper = await mountSuspended(DefaultLayout, { route })
  unmount = () => {
    wrapper.unmount()
  }
  return wrapper
}

describe('header', () => {
  it('lists the section links and the legal pages', async () => {
    const wrapper = await mount()
    const labels = wrapper.findAll('.main-nav a').map((a) => a.text())

    expect(labels).toStrictEqual([
      'Bestellung',
      'Arbeit',
      'Kultur',
      'Bildung',
      'Gäste',
      'Historie',
      'Kontakt',
      'Impressum',
      'Datenschutz',
    ])
  })

  it('points the section links at the old site', async () => {
    const wrapper = await mount()

    expect(wrapper.get('.main-nav a[href="https://www.dorf-uni.de/"]').text()).toBe('Bildung')
  })

  it('builds the logo source from the app base URL', async () => {
    const wrapper = await mount()

    expect(wrapper.get('.logo-img').attributes('src')).toBe('/img/logo.svg')
  })
})

describe('burger menu', () => {
  it('starts closed', async () => {
    const wrapper = await mount()

    expect(wrapper.get('.main-nav').classes()).not.toContain('open')
  })

  it('opens on the burger', async () => {
    const wrapper = await mount()

    await wrapper.get('.burger').trigger('click')

    expect(wrapper.get('.main-nav').classes()).toContain('open')
    expect(wrapper.get('.burger').classes()).toContain('open')
  })

  it('closes again when a link is followed', async () => {
    // On a phone the menu covers the page; leaving it open would hide the target.
    const wrapper = await mount()
    await wrapper.get('.burger').trigger('click')

    await wrapper.get('.main-nav a').trigger('click')

    expect(wrapper.get('.main-nav').classes()).not.toContain('open')
  })

  it('closes for every entry, not only the first', async () => {
    const wrapper = await mount()
    const links = wrapper.findAll('.main-nav a')

    for (const link of links) {
      await wrapper.get('.burger').trigger('click')
      expect(wrapper.get('.main-nav').classes()).toContain('open')

      await link.trigger('click')

      expect(wrapper.get('.main-nav').classes()).not.toContain('open')
    }
  })
})

describe('active state', () => {
  it('marks the shop link on the shop', async () => {
    const wrapper = await mount('/shop')

    expect(wrapper.get('.main-nav a').classes()).toContain('active')
  })

  it('marks it on a product page too', async () => {
    const wrapper = await mount('/shop/1/honig')

    expect(wrapper.get('.main-nav a').classes()).toContain('active')
  })

  it('leaves it alone elsewhere', async () => {
    const wrapper = await mount('/impressum')

    expect(wrapper.get('.main-nav a').classes()).not.toContain('active')
  })
})

describe('logo', () => {
  it('scrolls to the top instead of reloading the start page', async () => {
    const wrapper = await mount('/')

    await wrapper.get('.logo').trigger('click')

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })

  it('navigates home from anywhere else', async () => {
    const wrapper = await mount('/impressum')
    const push = vi.spyOn(useRouter(), 'push')

    await wrapper.get('.logo').trigger('click')

    expect(window.scrollTo).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith('/')
    push.mockRestore()
  })
})

describe('shrinking header', () => {
  it('shrinks after scrolling down', async () => {
    const wrapper = await mount()

    scrollTo(200)
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.header').classes()).toContain('scrolled')
  })

  it('stays full size within the first 50 pixels', async () => {
    const wrapper = await mount()

    scrollTo(40)
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.header').classes()).not.toContain('scrolled')
  })

  it('comes back when scrolling up', async () => {
    // The header is the only navigation on mobile — scrolling up means the user
    // is looking for it.
    const wrapper = await mount()
    scrollTo(400)
    await wrapper.vm.$nextTick()

    scrollTo(300)
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.header').classes()).not.toContain('scrolled')
  })

  it('stops listening once the layout is gone', async () => {
    const wrapper = await mount()
    scrollTo(400)
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.header').classes()).toContain('scrolled')

    wrapper.unmount()

    // Would throw through the scroll handler if the listener were still attached.
    expect(() => {
      scrollTo(800)
    }).not.toThrow()
  })
})

describe('the active section marker', () => {
  it('watches the hero on the start page', async () => {
    const wrapper = await mount('/')
    // The hero lives in the page, not in the layout, so the test supplies it.
    const hero = document.createElement('section')
    hero.id = 'hero'
    document.body.append(hero)
    await useRouter().push('/impressum')
    await useRouter().push('/')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(observers.at(-1)?.observed).toContain(hero)

    observers
      .at(-1)!
      .callback(
        [{ isIntersecting: true, target: hero } as unknown as IntersectionObserverEntry],
        observers.at(-1) as unknown as IntersectionObserver,
      )
    await nextTick()

    expect(wrapper.get('.logo').classes()).toContain('active')
    hero.remove()
  })

  it('ignores a section that scrolled out of view again', async () => {
    const wrapper = await mount('/')
    const hero = document.createElement('section')
    hero.id = 'hero'
    document.body.append(hero)
    await useRouter().push('/impressum')
    await useRouter().push('/')
    await new Promise((resolve) => setTimeout(resolve, 0))

    observers
      .at(-1)!
      .callback(
        [{ isIntersecting: false, target: hero } as unknown as IntersectionObserverEntry],
        observers.at(-1) as unknown as IntersectionObserver,
      )
    await nextTick()

    expect(wrapper.get('.logo').classes()).not.toContain('active')
    hero.remove()
  })

  it('starts a fresh observer on every return to the start page', async () => {
    await mount('/')
    const hero = document.createElement('section')
    hero.id = 'hero'
    document.body.append(hero)
    await useRouter().push('/impressum')
    await useRouter().push('/')
    await new Promise((resolve) => setTimeout(resolve, 0))
    const before = observers.length

    await useRouter().push('/impressum')
    await useRouter().push('/')
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Exactly one new one, and the previous one is gone — otherwise every
    // return to the start page would leave another observer behind.
    expect(observers).toHaveLength(before + 1)
    expect(observers[before - 1].disconnected).toBe(true)
    hero.remove()
  })

  it('clears the marker when leaving the start page', async () => {
    const wrapper = await mount('/')

    await useRouter().push('/impressum')
    await nextTick()

    expect(wrapper.get('.logo').classes()).not.toContain('active')
  })
})

describe('storage warning', () => {
  it('stays away until storage is actually needed', async () => {
    await mount()

    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('explains why the cart cannot work', async () => {
    await mount()

    expect(useStorage().require()).toBe(false)
    await nextTick()

    expect(document.body.textContent).toContain('Cookies erforderlich')
  })

  it('can be dismissed by clicking beside it', async () => {
    await mount()
    useStorage().require()
    await nextTick()
    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')!

    // @click.self on the container — a click bubbling up from the panel must
    // not count.
    dialog.parentElement!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(document.body.textContent).not.toContain('Cookies erforderlich')
  })

  it('can be dismissed', async () => {
    await mount()
    useStorage().require()
    await nextTick()

    const button = [...document.querySelectorAll('button')].find(
      (b) => b.textContent === 'Verstanden',
    )
    button?.click()
    await nextTick()

    expect(document.body.textContent).not.toContain('Cookies erforderlich')
  })
})

// Order matters here: accepting flips a module-level flag that stays set for the
// rest of the file, exactly as it stays set for the rest of a browser session.
describe('cookie banner', () => {
  it('appears when consent is asked for and not yet given', async () => {
    await mount()

    useConsent().require()
    await nextTick()

    expect(document.body.textContent).toContain('Cookie-Hinweis')
  })

  it('drops the pending action when declined', async () => {
    await mount()
    const action = vi.fn()
    useConsent().require(action)
    await nextTick()

    const decline = [...document.querySelectorAll('button')].find(
      (b) => b.textContent === 'Ablehnen',
    )
    decline?.click()
    await nextTick()

    expect(action).not.toHaveBeenCalled()
    expect(localStorage.getItem(CONSENT_KEY)).toBeNull()
    expect(document.body.textContent).not.toContain('Cookie-Hinweis')
  })

  it('closes when the customer leaves for the privacy policy', async () => {
    await mount()
    useConsent().require()
    await nextTick()

    const link = [...document.querySelectorAll('a')].find(
      (a) => a.textContent === 'Datenschutzerklärung',
    )
    link?.click()
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Leaving the banner open on top of the policy would be absurd.
    expect(document.body.textContent).not.toContain('Cookie-Hinweis')
  })

  it('runs the pending action once accepted', async () => {
    await mount()
    const action = vi.fn()
    useConsent().require(action)
    await nextTick()

    const accept = [...document.querySelectorAll('button')].find(
      (b) => b.textContent === 'Akzeptieren',
    )
    accept?.click()
    await nextTick()

    expect(action).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(CONSENT_KEY)).toBe('true')
    expect(document.body.textContent).not.toContain('Cookie-Hinweis')
  })
})

describe('footer', () => {
  it('carries the legal links', async () => {
    const wrapper = await mount()
    const hrefs = wrapper.findAll('.footer-section a').map((a) => a.attributes('href'))

    expect(hrefs).toContain('/impressum')
    expect(hrefs).toContain('/datenschutz')
  })
})

describe('content', () => {
  it('renders the page into the slot', async () => {
    const wrapper = await mountSuspended(DefaultLayout, {
      route: '/',
      slots: { default: () => 'Seiteninhalt' },
    })

    expect(wrapper.get('main').text()).toBe('Seiteninhalt')
  })
})
