// @vitest-environment node
import { describe, it, expect } from 'vitest'

import { useAdminFormat } from './useAdminFormat'

const { euro, dateTime, date, statusClass } = useAdminFormat()

describe('euro', () => {
  it('formats with two decimals and a German decimal comma', () => {
    expect(euro(12.5)).toBe('12,50 €')
    expect(euro(0)).toBe('0,00 €')
  })

  it('rounds to cents', () => {
    expect(euro(1.005)).toBe('1,00 €')
    expect(euro(1.006)).toBe('1,01 €')
  })

  it('renders negative amounts', () => {
    expect(euro(-3.4)).toBe('-3,40 €')
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('shows a dash for %s', (_label, value) => {
    expect(euro(value)).toBe('–')
  })
})

describe('dateTime', () => {
  it('renders date and time in German notation', () => {
    // The suite runs with TZ=UTC (see package.json) so this is deterministic.
    expect(dateTime('2026-03-04T05:06:00Z')).toBe('04.03.2026, 05:06')
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty string', ''],
  ])('shows a dash for %s', (_label, value) => {
    expect(dateTime(value)).toBe('–')
  })

  it('passes an unparsable value through unchanged', () => {
    expect(dateTime('kein Datum')).toBe('kein Datum')
  })
})

describe('date', () => {
  it('renders the date only', () => {
    expect(date('2026-03-04T05:06:00Z')).toBe('04.03.2026')
  })

  it('shows a dash for a missing value', () => {
    expect(date(null)).toBe('–')
  })

  it('passes an unparsable value through unchanged', () => {
    expect(date('kein Datum')).toBe('kein Datum')
  })
})

describe('statusClass', () => {
  it.each([
    [1, 'bg-amber-100 text-amber-800'],
    [2, 'bg-blue-100 text-blue-800'],
    [3, 'bg-green-100 text-green-800'],
    [4, 'bg-purple-100 text-purple-800'],
  ])('maps osCommerce status %i to its badge classes', (id, expected) => {
    expect(statusClass(id)).toBe(expected)
  })

  it('falls back to neutral classes for an unknown status', () => {
    expect(statusClass(99)).toBe('bg-gray-100 text-gray-700')
  })
})

describe('errorMessage', () => {
  const { errorMessage } = useAdminFormat()

  it.each([
    [
      'what the handler said',
      { data: { statusMessage: 'Status nicht erlaubt' } },
      'Status nicht erlaubt',
    ],
    [
      'a status message on the error itself',
      { statusMessage: 'Kein Mailserver' },
      'Kein Mailserver',
    ],
    ['the transport message', { message: '[POST] "/x": 500' }, '[POST] "/x": 500'],
    ['a last resort for a value that says nothing', {}, 'unbekannt'],
  ])('reports %s', (_label, error, expected) => {
    expect(errorMessage(error)).toBe(expected)
  })

  it('prefers the handler message over the transport one', () => {
    expect(
      errorMessage({ data: { statusMessage: 'Schon bestätigt' }, message: '[POST] "/x": 409' }),
    ).toBe('Schon bestätigt')
  })
})
