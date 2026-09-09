// @vitest-environment node
import { describe, it, expect } from 'vitest'

import { COUNTRY_IDS } from './countries'

/**
 * The ids are foreign keys into the osCommerce `countries` table — a wrong value
 * silently writes an order to the wrong country, so pin them.
 */
describe('COUNTRY_IDS', () => {
  it('maps the three supported countries to their osCommerce ids', () => {
    expect(COUNTRY_IDS).toStrictEqual({
      DE: { id: 81, name: 'Deutschland' },
      AT: { id: 14, name: 'Oesterreich' },
      CH: { id: 204, name: 'Schweiz' },
    })
  })

  it('uses distinct ids', () => {
    const ids = Object.values(COUNTRY_IDS).map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
