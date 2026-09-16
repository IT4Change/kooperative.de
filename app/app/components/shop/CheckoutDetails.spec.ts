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

const IBAN_ENDPOINT = '/api/iban/info'

/**
 * Only the lookups this component made.
 *
 * `globalThis.$fetch` is replaced wholesale, so the mock also catches requests
 * that have nothing to do with the component: Nuxt fetches its build manifest
 * (`/_nuxt/builds/meta/*.json`) on its own schedule, and on a loaded machine
 * that lands inside a test. Counting those made every assertion over the call
 * count flaky — "expected 0, got 1" and "expected 1, got 2", in whichever test
 * happened to be running when the manifest request went out.
 */
const ibanCalls = () => fetchMock.mock.calls.filter(([url]) => String(url) === IBAN_ENDPOINT)

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

/**
 * Polls until `ready()` holds, draining the fake clock, the microtask queue and
 * Vue's render queue between attempts.
 *
 * Same reasoning as test/helpers/wait.ts — which cannot be used here, because it
 * sleeps on a real setTimeout and these tests run on fake timers: how many ticks
 * a debounced lookup needs before its answer reaches the DOM depends on machine
 * load. Reasoning about the order in which promise handlers were attached
 * instead held locally and broke on a loaded runner — sometimes as a failing
 * assertion, sometimes only as a branch missing from the coverage report.
 */
async function until(ready: () => boolean, description: string): Promise<void> {
  for (let i = 0; i < 400; i++) {
    if (ready()) return
    await vi.advanceTimersByTimeAsync(5)
    await nextTick()
  }
  throw new Error(`Timed out waiting for ${description}`)
}

/**
 * Drains the pending ticks **without moving the clock**, so a watcher that has
 * not run yet gets to install its debounce timer before any timer can fire.
 * Skipping this lets the clock jump past a timer the next prop change was
 * supposed to cancel, and the component issues two lookups instead of one.
 */
async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) await nextTick()
}

/**
 * Drains whatever is still queued, well past the 250 ms debounce. For the
 * assertions that say *nothing* more happened: there is no state change to poll
 * for, so the only honest gate is to let everything pending run first — and a
 * window shorter than the debounce would make those assertions pass for the
 * wrong reason.
 */
async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await vi.advanceTimersByTimeAsync(50)
    await nextTick()
  }
}

/** Hands out lookups whose answer the test decides. */
function deferredFetches() {
  interface Call {
    promise: Promise<unknown>
    resolve: (v: unknown) => void
    reject: (e: unknown) => void
  }
  const calls: Call[] = []
  fetchMock.mockImplementation(async (url: unknown) => {
    // Anything that is not the lookup gets a trivial answer and is not recorded
    // — otherwise Nuxt's build-manifest request would become calls[0] and the
    // test would resolve the wrong promise. See ibanCalls().
    if (String(url) !== IBAN_ENDPOINT) return {}
    const call = {} as Call
    call.promise = new Promise((resolve, reject) => {
      call.resolve = resolve
      call.reject = reject
    })
    calls.push(call)
    return call.promise
  })
  return {
    at: (i: number) => calls[i],
    /** Waits until `n` lookups have actually left the component. */
    async dispatched(n: number) {
      await until(() => calls.length >= n, `${n} dispatched lookup(s)`)
    },
  }
}

describe('live IBAN lookup', () => {
  it('resolves the bank once enough has been typed', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = await mount({ shipping: 'abholung', payment: 'lastschrift' })
      await wrapper.setProps({ iban: 'DE89370400440532013000' })

      await until(() => wrapper.text().includes('Commerzbank'), 'the bank name')

      expect(fetchMock).toHaveBeenCalledWith('/api/iban/info', {
        query: { iban: 'DE89370400440532013000' },
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('asks nothing for a fragment', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = await mount({ shipping: 'abholung', payment: 'lastschrift' })
      await wrapper.setProps({ iban: 'DE8' })

      await settle()

      // Every keystroke hitting the API would be wasteful and pointless.
      expect(ibanCalls()).toHaveLength(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('warns about an IBAN the server rejects', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue({ ok: true, valid: false })
    try {
      // Everything else is filled in, so the rejected IBAN is the only thing
      // standing between the customer and the next step.
      const wrapper = await mount({
        shipping: 'abholung',
        payment: 'lastschrift',
        accountHolder: 'Erika Musterfrau',
      })
      await wrapper.setProps({ iban: 'DE00000000000000000000' })

      await until(() => wrapper.text().includes('ungültig'), 'the rejection notice')

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

      await until(() => wrapper.text().includes('12345678'), 'the BLZ')

      // Without a name the code itself is all the customer gets to recognise.
      expect(wrapper.text()).toContain('BLZ 12345678')
    } finally {
      vi.useRealTimers()
    }
  })

  it('asks only once while the customer is still typing', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = await mount({ shipping: 'abholung', payment: 'lastschrift' })
      await wrapper.setProps({ iban: 'DE8937040044' })
      // The clock may only move once this lookup's timer is actually installed.
      await flush()
      await vi.advanceTimersByTimeAsync(100)

      // Still within the debounce window — the pending lookup is dropped.
      await wrapper.setProps({ iban: 'DE89370400440532013000' })
      await flush()
      await settle()

      expect(ibanCalls()).toHaveLength(1)
      expect(fetchMock).toHaveBeenCalledWith(IBAN_ENDPOINT, {
        query: { iban: 'DE89370400440532013000' },
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('names a bank the Bundesbank list has no code for', async () => {
    vi.useFakeTimers()
    fetchMock.mockResolvedValue({ ok: true, valid: true, bankName: 'Kooperative Bank' })
    try {
      const wrapper = await mount({ shipping: 'abholung', payment: 'lastschrift' })
      await wrapper.setProps({ iban: 'DE89370400440532013000' })

      await until(() => wrapper.text().includes('Kooperative Bank'), 'the bank name')

      expect(wrapper.text()).not.toContain('BLZ')
    } finally {
      vi.useRealTimers()
    }
  })

  it('opens the way forward once the server confirms the IBAN', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = await mount({
        shipping: 'abholung',
        payment: 'lastschrift',
        accountHolder: 'Erika Musterfrau',
      })
      await wrapper.setProps({ iban: 'DE89370400440532013000' })

      await until(
        () => nextButton(wrapper).attributes('disabled') === undefined,
        'the next button to open up',
      )

      expect(nextButton(wrapper).attributes('disabled')).toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })

  it('ignores an answer that a newer lookup has already overtaken', async () => {
    vi.useFakeTimers()
    const deferred = deferredFetches()
    try {
      const wrapper = await mount({ shipping: 'abholung', payment: 'lastschrift' })
      await wrapper.setProps({ iban: 'DE89370400440532013000' })
      await deferred.dispatched(1)
      await wrapper.setProps({ iban: 'DE89100000000000000000' })
      await deferred.dispatched(2)

      // The second answer arrives first, the first one late.
      deferred.at(1).resolve({ ok: true, valid: true, bankName: 'Zweite Bank' })
      await until(() => wrapper.text().includes('Zweite Bank'), 'the second bank')
      deferred.at(0).resolve({ ok: true, valid: true, bankName: 'Erste Bank' })
      await settle()

      // Otherwise the customer would see the bank of an IBAN they overwrote.
      expect(wrapper.text()).toContain('Zweite Bank')
      expect(wrapper.text()).not.toContain('Erste Bank')
    } finally {
      vi.useRealTimers()
    }
  })

  it('ignores a late failure of a lookup that was overtaken', async () => {
    vi.useFakeTimers()
    const deferred = deferredFetches()
    try {
      const wrapper = await mount({ shipping: 'abholung', payment: 'lastschrift' })
      await wrapper.setProps({ iban: 'DE89370400440532013000' })
      await deferred.dispatched(1)
      await wrapper.setProps({ iban: 'DE89100000000000000000' })
      await deferred.dispatched(2)

      deferred.at(1).resolve({ ok: true, valid: true, bankName: 'Zweite Bank' })
      await until(() => wrapper.text().includes('Zweite Bank'), 'the second bank')
      deferred.at(0).reject(new Error('offline'))
      await settle()

      // A stale failure must not wipe the result the customer is looking at.
      expect(wrapper.text()).toContain('Zweite Bank')
    } finally {
      vi.useRealTimers()
    }
  })

  /**
   * With a bank on screen beforehand, because both assertions at the bottom
   * already held before the failure was handled: the earlier version of this
   * test passed whether or not the component's catch had run, and the only
   * trace of the difference was a branch missing from the coverage report.
   */
  it('stays quiet when the lookup fails', async () => {
    vi.useFakeTimers()
    const deferred = deferredFetches()
    try {
      const wrapper = await mount({
        shipping: 'abholung',
        payment: 'lastschrift',
        accountHolder: 'Erika',
      })
      await wrapper.setProps({ iban: 'DE89370400440532013000' })
      await deferred.dispatched(1)
      deferred.at(0).resolve({ ok: true, valid: true, bankName: 'Commerzbank' })
      await until(() => wrapper.text().includes('Commerzbank'), 'the bank name')

      // The old answer stays on screen until the new one arrives, so the bank
      // disappearing is the proof that the failure was actually handled.
      await wrapper.setProps({ iban: 'DE89100000000000000000' })
      await deferred.dispatched(2)
      deferred.at(1).reject(new Error('offline'))
      await until(() => !wrapper.text().includes('Commerzbank'), 'the bank name to clear')
      // A lookup outage must not block an otherwise valid order — the server
      // validates again on submit.
      expect(wrapper.text()).not.toContain('ungültig')
      expect(nextButton(wrapper).attributes('disabled')).toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })
})
