import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'

import LegalDialog from './LegalDialog.vue'

import { LEGAL_PAGES } from '~/data/legalPages'

/**
 * "Rechtliches": one dialog, a tab per legal page. It is teleported to <body>,
 * so the assertions look there.
 */
for (const page of LEGAL_PAGES) {
  registerEndpoint(`/api/legal/${page.slug}`, () => ({
    slug: page.slug,
    title: page.title,
    html: `<p>Text ${page.slug}</p>`,
    versionNo: 1,
    activatedAt: '2026-10-01T00:00:00.000Z',
  }))
}

let unmount: (() => void) | null = null

beforeEach(() => {
  useLegal().close()
})

afterEach(() => {
  unmount?.()
  unmount = null
  document.body.innerHTML = ''
})

async function mount() {
  const wrapper = await mountSuspended(LegalDialog)
  unmount = () => {
    wrapper.unmount()
  }
  return wrapper
}

/** Suspense resolves on a later tick than the state change. */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await nextTick()
}

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')
const tabs = () => [...document.querySelectorAll<HTMLElement>('[role="tab"]')]
const selected = () => tabs().find((t) => t.getAttribute('aria-selected') === 'true')

describe('LegalDialog', () => {
  it('stays out of the page while closed', async () => {
    await mount()

    expect(dialog()).toBeNull()
  })

  it('opens on the requested page with a tab for every legal page', async () => {
    await mount()

    useLegal().open('agb')
    await settle()

    expect(dialog()?.getAttribute('aria-modal')).toBe('true')
    expect(tabs().map((t) => t.textContent.trim())).toStrictEqual(LEGAL_PAGES.map((p) => p.label))
    expect(selected()?.textContent.trim()).toBe('AGB')
    expect(document.querySelector('h3')?.textContent).toBe('Allgemeine Geschäftsbedingungen')
    expect(document.querySelector('[data-testid="legal-content"]')?.textContent).toBe('Text agb')
  })

  it('scrolls the selected tab into view, for the narrow tab bar on a phone', async () => {
    await mount()
    const scrolled: string[] = []
    const original = HTMLElement.prototype.scrollIntoView
    HTMLElement.prototype.scrollIntoView = function (this: HTMLElement) {
      scrolled.push(this.textContent.trim())
    }
    try {
      useLegal().open('versand')
      await settle()
    } finally {
      HTMLElement.prototype.scrollIntoView = original
    }

    expect(scrolled).toStrictEqual(['Versand & Zahlung'])
  })

  it('switches pages through the tabs', async () => {
    await mount()
    useLegal().open('impressum')
    await settle()

    tabs()[3].click()
    await settle()

    expect(useLegal().current.value).toBe('widerruf')
    expect(document.querySelector('[data-testid="legal-content"]')?.textContent).toBe(
      'Text widerruf',
    )
  })

  it('moves between tabs with the arrow keys, wrapping at both ends, and Home/End', async () => {
    await mount()
    useLegal().open('impressum')
    await settle()
    const list = document.querySelector('[role="tablist"]')!
    const key = async (k: string) => {
      list.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
      await settle()
      return useLegal().current.value
    }

    await expect(key('ArrowLeft')).resolves.toBe('versand')
    expect(document.activeElement).toBe(selected())
    await expect(key('ArrowRight')).resolves.toBe('impressum')
    await expect(key('ArrowRight')).resolves.toBe('datenschutz')
    await expect(key('End')).resolves.toBe('versand')
    await expect(key('Home')).resolves.toBe('impressum')
    await expect(key('a')).resolves.toBe('impressum')
  })

  it('closes on the close button and on the backdrop', async () => {
    await mount()
    useLegal().open('impressum')
    await settle()

    document.querySelector<HTMLElement>('[aria-label="Schließen"]')!.click()
    await nextTick()
    expect(useLegal().isOpen.value).toBe(false)

    useLegal().open('impressum')
    await settle()
    document.querySelector<HTMLElement>('.bg-black\\/50')!.click()
    await nextTick()
    expect(useLegal().isOpen.value).toBe(false)
  })

  it('offers the page on its own URL and closes when that is followed', async () => {
    await mount()
    useLegal().open('versand')
    await settle()

    const link = [...document.querySelectorAll('a')].find(
      (a) => a.textContent === 'Als eigene Seite öffnen',
    )!
    expect(link.getAttribute('href')).toBe('/versand')
    link.click()
    await nextTick()

    expect(useLegal().isOpen.value).toBe(false)
  })
})
