import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Consent for the technically necessary local storage. Nothing may be persisted
 * before it is given, and the action that triggered the question is queued so
 * the customer does not have to click "add to cart" twice.
 *
 * State lives at module level; each test imports the module fresh.
 */
const CONSENT_KEY = 'kooperative-consent-v1'

async function freshConsent() {
  vi.resetModules()
  const { useConsent } = await import('./useConsent')
  return useConsent()
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('first visit', () => {
  it('starts without consent', async () => {
    const consent = await freshConsent()

    expect(consent.consentGiven.value).toBe(false)
    expect(consent.showBanner.value).toBe(false)
  })

  it('asks instead of running the action', async () => {
    const consent = await freshConsent()
    const action = vi.fn()

    expect(consent.require(action)).toBe(false)
    expect(consent.showBanner.value).toBe(true)
    expect(action).not.toHaveBeenCalled()
  })

  it('runs the queued action once consent is given', async () => {
    const consent = await freshConsent()
    const action = vi.fn()
    consent.require(action)

    consent.accept()

    // The customer clicked "add to cart" — after accepting, that is what they
    // expect to have happened, not a second click.
    expect(action).toHaveBeenCalledTimes(1)
    expect(consent.showBanner.value).toBe(false)
    expect(consent.consentGiven.value).toBe(true)
  })

  it('persists the consent', async () => {
    const consent = await freshConsent()

    consent.accept()

    expect(localStorage.getItem(CONSENT_KEY)).toBe('true')
  })

  it('drops the queued action when the customer declines', async () => {
    const consent = await freshConsent()
    const action = vi.fn()
    consent.require(action)

    consent.decline()

    expect(action).not.toHaveBeenCalled()
    expect(consent.showBanner.value).toBe(false)
    expect(consent.consentGiven.value).toBe(false)
  })

  it('does not carry a declined action into the next acceptance', async () => {
    const consent = await freshConsent()
    const action = vi.fn()
    consent.require(action)
    consent.decline()

    consent.accept()

    expect(action).not.toHaveBeenCalled()
  })

  it('works without an action to queue', async () => {
    const consent = await freshConsent()

    expect(consent.require()).toBe(false)
    expect(() => {
      consent.accept()
    }).not.toThrow()
  })
})

describe('returning visit', () => {
  it('picks the stored consent up', async () => {
    localStorage.setItem(CONSENT_KEY, 'true')

    const consent = await freshConsent()

    expect(consent.consentGiven.value).toBe(true)
  })

  it('runs the action straight away', async () => {
    localStorage.setItem(CONSENT_KEY, 'true')
    const consent = await freshConsent()
    const action = vi.fn()

    expect(consent.require(action)).toBe(true)
    expect(action).toHaveBeenCalledTimes(1)
    expect(consent.showBanner.value).toBe(false)
  })

  it('assumes no consent when reading it throws', async () => {
    vi.spyOn(globalThis.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })

    const consent = await freshConsent()

    // Fail closed: without a readable record there is no consent on file.
    expect(consent.consentGiven.value).toBe(false)
  })

  it('treats any other stored value as no consent', async () => {
    localStorage.setItem(CONSENT_KEY, 'maybe')

    expect((await freshConsent()).consentGiven.value).toBe(false)
  })
})

describe('when localStorage is unavailable', () => {
  it('starts without consent rather than crashing', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })

    expect((await freshConsent()).consentGiven.value).toBe(false)
  })

  it('still applies the consent for this session', async () => {
    const consent = await freshConsent()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })

    consent.accept()

    // It cannot be remembered for next time, but asking again in the same
    // session would be absurd.
    expect(consent.consentGiven.value).toBe(true)
  })
})
