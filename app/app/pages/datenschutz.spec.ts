import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { useConsent } from '../composables/useConsent'

import DatenschutzPage from './datenschutz.vue'

/**
 * The privacy policy. Mostly static text; the part with behaviour is the
 * withdrawal of the storage consent, which Art. 7 Abs. 3 DSGVO requires to be
 * as easy as giving it.
 */
const CONSENT_KEY = 'kooperative-consent-v1'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  useConsent().revoke()
})

describe('datenschutz page', () => {
  it('names the controller', async () => {
    const wrapper = await mountSuspended(DatenschutzPage)

    expect(wrapper.text()).toContain('Verantwortlicher')
    expect(wrapper.text()).toContain('Kooperative Dürnau Verwaltungsgesellschaft mbH')
    expect(wrapper.text()).toContain('Art. 77 DSGVO')
  })

  it('says so when no consent is on file', async () => {
    const wrapper = await mountSuspended(DatenschutzPage)

    expect(wrapper.find('[data-testid="consent-state"]').text()).toContain(
      'keine Einwilligung gespeichert',
    )
    expect(wrapper.find('[data-testid="consent-revoke"]').exists()).toBe(false)
  })

  it('lets a given consent be withdrawn', async () => {
    useConsent().accept()
    localStorage.setItem('kooperative-cart', '[]')
    const wrapper = await mountSuspended(DatenschutzPage)

    await wrapper.find('[data-testid="consent-revoke"]').trigger('click')

    expect(localStorage.getItem(CONSENT_KEY)).toBeNull()
    expect(localStorage.getItem('kooperative-cart')).toBeNull()
    expect(wrapper.find('[data-testid="consent-state"]').text()).toContain(
      'keine Einwilligung gespeichert',
    )
  })
})
