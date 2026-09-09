import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import CheckoutDetails from './CheckoutDetails.vue'

/**
 * Shipping and payment. The gate that matters is `canProceed`: a direct debit
 * may only continue with an account holder and an IBAN the server will accept,
 * because otherwise the customer is sent forward only to be rejected.
 *
 * The live IBAN lookup is debounced by 250 ms and hits /api/iban/info, so the
 * tests drive the timers rather than waiting.
 */
const BASE = {
  shipping: null,
  payment: null,
  notes: '',
  accountHolder: '',
  iban: '',
}

const fetchMock = vi.fn()

const mount = async (props: Partial<typeof BASE> = {}) =>
  mountSuspended(CheckoutDetails, { props: { ...BASE, ...props } })

const nextButton = (w: Awaited<ReturnType<typeof mount>>) =>
  w.findAll('button').find((b) => b.text().includes('Weiter'))!

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, valid: true, blz: '37040044', bankName: 'Commerzbank' })
  globalThis.$fetch = fetchMock as unknown as typeof $fetch
})

describe('options', () => {
  it('offers every shipping and payment method', async () => {
    const wrapper = await mount()

    expect(wrapper.findAll('input[name="shipping"]')).toHaveLength(5)
    expect(wrapper.findAll('input[name="payment"]')).toHaveLength(3)
  })

  it('emits the chosen shipping method', async () => {
    const wrapper = await mount()

    await wrapper.get('input[name="shipping"][value="dpd"]').setValue()

    expect(wrapper.emitted('update:shipping')?.[0]).toStrictEqual(['dpd'])
  })

  it('emits the chosen payment method', async () => {
    const wrapper = await mount()

    await wrapper.get('input[name="payment"][value="rechnung"]').setValue()

    expect(wrapper.emitted('update:payment')?.[0]).toStrictEqual(['rechnung'])
  })

  it('emits the note as it is typed', async () => {
    const wrapper = await mount()

    await wrapper.get('textarea').setValue('Bitte klingeln')

    expect(wrapper.emitted('update:notes')?.[0]).toStrictEqual(['Bitte klingeln'])
  })
})

describe('progressing', () => {
  it('blocks until both methods are chosen', async () => {
    const wrapper = await mount()

    expect(nextButton(wrapper).attributes('disabled')).toBeDefined()
  })

  it('allows progress once both are chosen', async () => {
    const wrapper = await mount({ shipping: 'abholung', payment: 'vorkasse' })

    expect(nextButton(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('emits next', async () => {
    const wrapper = await mount({ shipping: 'abholung', payment: 'vorkasse' })

    await nextButton(wrapper).trigger('click')

    expect(wrapper.emitted('next')).toHaveLength(1)
  })

  it('emits back', async () => {
    const wrapper = await mount()

    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Zurück'))!
      .trigger('click')

    expect(wrapper.emitted('back')).toHaveLength(1)
  })
})

describe('direct debit', () => {
  it('reveals the bank fields only for Lastschrift', async () => {
    const other = await mount({ shipping: 'abholung', payment: 'vorkasse' })
    expect(other.find('input[maxlength="34"]').exists()).toBe(false)

    const debit = await mount({ shipping: 'abholung', payment: 'lastschrift' })
    expect(debit.find('input[maxlength="34"]').exists()).toBe(true)
  })

  it('blocks progress without an account holder', async () => {
    const wrapper = await mount({
      shipping: 'abholung',
      payment: 'lastschrift',
      iban: 'DE89370400440532013000',
    })

    expect(nextButton(wrapper).attributes('disabled')).toBeDefined()
  })

  it('blocks progress while the IBAN is still too short', async () => {
    const wrapper = await mount({
      shipping: 'abholung',
      payment: 'lastschrift',
      accountHolder: 'Erika',
      iban: 'DE89',
    })

    expect(nextButton(wrapper).attributes('disabled')).toBeDefined()
  })

  it('allows progress with a complete set', async () => {
    const wrapper = await mount({
      shipping: 'abholung',
      payment: 'lastschrift',
      accountHolder: 'Erika',
      iban: 'DE89370400440532013000',
    })

    expect(nextButton(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('emits the IBAN as it is typed', async () => {
    const wrapper = await mount({ shipping: 'abholung', payment: 'lastschrift' })

    await wrapper.get('input[maxlength="34"]').setValue('DE89')

    expect(wrapper.emitted('update:iban')?.[0]).toStrictEqual(['DE89'])
  })

  it('emits the account holder as it is typed', async () => {
    const wrapper = await mount({ shipping: 'abholung', payment: 'lastschrift' })

    await wrapper.get('input[maxlength="64"]').setValue('Erika Musterfrau')

    expect(wrapper.emitted('update:accountHolder')?.[0]).toStrictEqual(['Erika Musterfrau'])
  })
})

describe('live IBAN lookup', () => {
  it('resolves the bank once enough has been typed', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = await mount({ shipping: 'abholung', payment: 'lastschrift' })
      await wrapper.setProps({ iban: 'DE89370400440532013000' })

      await vi.advanceTimersByTimeAsync(300)
      await wrapper.vm.$nextTick()

      expect(fetchMock).toHaveBeenCalledWith('/api/iban/info', {
        query: { iban: 'DE89370400440532013000' },
      })
      expect(wrapper.text()).toContain('Commerzbank')
    } finally {
      vi.useRealTimers()
    }
  })

  it('asks nothing for a fragment', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = await mount({ shipping: 'abholung', payment: 'lastschrift' })
      await wrapper.setProps({ iban: 'DE8' })

      await vi.advanceTimersByTimeAsync(300)

      // Every keystroke hitting the API would be wasteful and pointless.
      expect(fetchMock).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('warns about an IBAN the server rejects', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue({ ok: true, valid: false })
    try {
      const wrapper = await mount({ shipping: 'abholung', payment: 'lastschrift' })
      await wrapper.setProps({ iban: 'DE00000000000000000000' })

      await vi.advanceTimersByTimeAsync(300)
      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('ungültig')
      // And it must not let the customer continue into a rejection.
      expect(nextButton(wrapper).attributes('disabled')).toBeDefined()
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports a known BLZ without a bank name', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue({ ok: true, valid: true, blz: '12345678' })
    try {
      const wrapper = await mount({ shipping: 'abholung', payment: 'lastschrift' })
      await wrapper.setProps({ iban: 'DE89123456780532013000' })

      await vi.advanceTimersByTimeAsync(300)
      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('12345678')
    } finally {
      vi.useRealTimers()
    }
  })

  it('stays quiet when the lookup fails', async () => {
    vi.useFakeTimers()
    fetchMock.mockRejectedValue(new Error('offline'))
    try {
      const wrapper = await mount({
        shipping: 'abholung',
        payment: 'lastschrift',
        accountHolder: 'Erika',
      })
      await wrapper.setProps({ iban: 'DE89370400440532013000' })

      await vi.advanceTimersByTimeAsync(300)
      await wrapper.vm.$nextTick()

      // A lookup outage must not block an otherwise valid order — the server
      // validates again on submit.
      expect(wrapper.text()).not.toContain('ungültig')
      expect(nextButton(wrapper).attributes('disabled')).toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })
})
