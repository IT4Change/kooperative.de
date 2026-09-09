import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import CheckoutConfirm from './CheckoutConfirm.vue'

import type { CartItem, Product } from '~/data/products'

/**
 * The last screen before the order goes out. It is the customer's chance to
 * catch a mistake, so everything they chose has to be visible — and the IBAN
 * has to be masked, because this panel sits open on a screen.
 */
function product(over: Partial<Product> = {}): Product {
  return {
    id: '1',
    name: 'Honig',
    price: 11.9,
    description: '',
    category: 'lebensmittel',
    images: [],
    slug: 'honig',
    ...over,
  }
}

const ITEMS: CartItem[] = [{ product: product(), quantity: 2 }]

const BASE = {
  items: ITEMS,
  totalPrice: 23.8,
  shipping: 'abholung' as const,
  payment: 'vorkasse' as const,
  iban: '',
  notes: '',
  submitting: false,
  submitError: '',
}

const mount = async (props: Partial<typeof BASE> = {}) =>
  mountSuspended(CheckoutConfirm, { props: { ...BASE, ...props } })

/** Signs a customer in through the composable the component reads. */
async function signIn(over: Record<string, unknown> = {}) {
  const { useAuth } = await import('../../composables/useAuth')
  globalThis.$fetch = vi.fn().mockResolvedValue({
    authenticated: true,
    customerId: 3,
    email: 'kundin@example.org',
    firstname: 'Erika',
    lastname: 'Musterfrau',
    telephone: '0711 123',
    address: { street: 'Im Winkel 11', postcode: '88422', city: 'Dürnau', countryId: 81 },
    ...over,
  }) as unknown as typeof $fetch
  const auth = useAuth()
  await auth.refresh()
  return auth
}

beforeEach(() => {
  globalThis.$fetch = vi
    .fn()
    .mockResolvedValue({ authenticated: false }) as unknown as typeof $fetch
})

describe('the delivery address', () => {
  it('stays away while nobody is signed in', async () => {
    const wrapper = await mount()

    expect(wrapper.text()).not.toContain('Lieferadresse')
  })

  it('shows the address on file with a way to correct it', async () => {
    await signIn()

    const wrapper = await mount()

    expect(wrapper.text()).toContain('Lieferadresse')
    expect(wrapper.text()).toContain('Erika Musterfrau')
    expect(wrapper.text()).toContain('Im Winkel 11')
    expect(wrapper.text()).toContain('88422 Dürnau')
    expect(wrapper.text()).toContain('0711 123')
    expect(wrapper.get('a[target="_blank"]').attributes('href')).toContain('account.php')
  })

  it('leaves the separator out for a customer without a phone number', async () => {
    await signIn({ telephone: '' })

    const wrapper = await mount()

    expect(wrapper.text()).toContain('kundin@example.org')
    expect(wrapper.text()).not.toContain('·')
  })
})

describe('summary', () => {
  it('marks shipping and payment as unset while nothing is chosen', async () => {
    // The step is reachable with both still empty; showing "undefined" there
    // would look like a bug rather than a missing choice.
    const wrapper = await mount({ shipping: null, payment: null })

    expect(wrapper.text()).toContain('Versand: –')
    expect(wrapper.text()).toContain('–')
  })

  it('prices a line at its chosen variant, and at the base if the index is stale', async () => {
    const sized = product({
      variants: [
        { productId: '1', size: '0,5 L', price: 9.52, amount: 0.5, referenceUnit: 'L', image: '' },
      ],
    })

    const chosen = await mount({ items: [{ product: sized, quantity: 1, variantIndex: 0 }] })
    expect(chosen.text()).toContain('9.52')

    const stale = await mount({ items: [{ product: sized, quantity: 1, variantIndex: 7 }] })
    expect(stale.text()).toContain('11.90')
  })

  it('lists the items with their totals', async () => {
    const wrapper = await mount()

    expect(wrapper.text()).toContain('Honig')
    expect(wrapper.text()).toContain('23.80')
  })

  it('names the chosen shipping and payment method', async () => {
    const wrapper = await mount({ shipping: 'dpd', payment: 'rechnung' })

    expect(wrapper.text()).toContain('Versand mit DPD')
    expect(wrapper.text()).toContain('Bezahlung mit Rechnung')
  })

  it('flags a shipping method without a fixed price', async () => {
    const wrapper = await mount({ shipping: 'abholung' })

    // The total is not final in that case, and the customer must see that.
    expect(wrapper.text()).toContain('nach Aufwand')
  })

  it('shows the note when there is one', async () => {
    const wrapper = await mount({ notes: 'Bitte klingeln' })

    expect(wrapper.text()).toContain('Bitte klingeln')
  })

  it('leaves the note block out when there is none', async () => {
    const wrapper = await mount()

    expect(wrapper.text()).not.toContain('Anmerkung')
  })

  it('names the chosen size of an item', async () => {
    const sized = product({
      id: '3',
      name: 'Olivenöl',
      variants: [
        { productId: '3', size: '0,5 L', price: 9.52, amount: 0.5, referenceUnit: 'L', image: '' },
        { productId: '4', size: '1 L', price: 17.85, amount: 1, referenceUnit: 'L', image: '' },
      ],
    })
    const wrapper = await mount({
      items: [{ product: sized, quantity: 1, variantIndex: 1 }],
      totalPrice: 17.85,
    })

    expect(wrapper.text()).toContain('1 L')
  })
})

describe('bank details', () => {
  it('masks the IBAN', async () => {
    const wrapper = await mount({ payment: 'lastschrift', iban: 'DE89 3704 0044 0532 0130 00' })

    // Enough to recognise it, not enough to read it off someone's screen.
    expect(wrapper.text()).toContain('DE89 •••• •••• 3000')
    expect(wrapper.text()).not.toContain('37040044')
  })

  it('masks an IBAN that is too short to abbreviate', async () => {
    const wrapper = await mount({ payment: 'lastschrift', iban: 'DE89' })

    expect(wrapper.text()).toContain('••••')
  })

  it('shows no bank block for another payment method', async () => {
    const wrapper = await mount({ payment: 'vorkasse', iban: 'DE89370400440532013000' })

    expect(wrapper.text()).not.toContain('••••')
  })
})

describe('sending', () => {
  it('emits send', async () => {
    const wrapper = await mount()

    const send = wrapper.findAll('button').find((b) => b.text().includes('absenden'))
    await send!.trigger('click')

    expect(wrapper.emitted('send')).toHaveLength(1)
  })

  it('emits back', async () => {
    const wrapper = await mount()

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('back')).toHaveLength(1)
  })

  it('locks both buttons while sending', async () => {
    const wrapper = await mount({ submitting: true })

    // Otherwise an impatient second click posts the order twice.
    for (const button of wrapper.findAll('button')) {
      expect(button.attributes('disabled')).toBeDefined()
    }
  })

  it('shows the error the server returned', async () => {
    const wrapper = await mount({ submitError: 'Artikel 1 nicht verfügbar' })

    expect(wrapper.text()).toContain('Artikel 1 nicht verfügbar')
  })
})
