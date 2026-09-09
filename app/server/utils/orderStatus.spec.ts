// @vitest-environment node
import { describe, it, expect } from 'vitest'

import { ORDER_STATUS_FLOW, buildStatusFlow } from './orderStatus'

const NAMES = new Map([
  [1, 'In Bearbeitung'],
  [2, 'Versandbereit'],
  [3, 'Versendet'],
  [4, 'Vorkasse erwartet'],
])

describe('buildStatusFlow', () => {
  it('marks everything before the current step as done and the rest as upcoming', () => {
    const flow = buildStatusFlow(2, NAMES, [])
    expect(flow.map((s) => [s.id, s.state])).toStrictEqual([
      [1, 'done'],
      [4, 'done'],
      [2, 'current'],
      [3, 'upcoming'],
    ])
  })

  it('keeps the canonical order regardless of the history order', () => {
    const flow = buildStatusFlow(1, NAMES, [])
    expect(flow.map((s) => s.id)).toStrictEqual(ORDER_STATUS_FLOW)
    expect(flow[0].state).toBe('current')
    expect(flow.slice(1).every((s) => s.state === 'upcoming')).toBe(true)
  })

  it('appends a status that is not part of the canonical flow', () => {
    const flow = buildStatusFlow(99, new Map([...NAMES, [99, 'Storniert']]), [])
    expect(flow.at(-1)).toMatchObject({ id: 99, name: 'Storniert', state: 'current' })
    // Everything canonical now lies before the current step.
    expect(flow.slice(0, 4).every((s) => s.state === 'done')).toBe(true)
  })

  it('records the first visit of each status from the history', () => {
    const flow = buildStatusFlow(2, NAMES, [
      { statusId: 1, dateAdded: '2026-01-01T10:00:00.000Z' },
      { statusId: 1, dateAdded: '2026-01-02T10:00:00.000Z' },
      { statusId: 2, dateAdded: '2026-01-03T10:00:00.000Z' },
    ])
    expect(flow.find((s) => s.id === 1)?.visitedAt).toBe('2026-01-01T10:00:00.000Z')
    expect(flow.find((s) => s.id === 2)?.visitedAt).toBe('2026-01-03T10:00:00.000Z')
    expect(flow.find((s) => s.id === 3)?.visitedAt).toBeNull()
  })

  it('normalizes Date history entries to ISO strings and skips null dates', () => {
    const flow = buildStatusFlow(1, NAMES, [
      { statusId: 1, dateAdded: new Date('2026-05-04T08:30:00.000Z') },
      { statusId: 4, dateAdded: null },
    ])
    expect(flow.find((s) => s.id === 1)?.visitedAt).toBe('2026-05-04T08:30:00.000Z')
    expect(flow.find((s) => s.id === 4)?.visitedAt).toBeNull()
  })

  it('falls back to a generic label for an unnamed status', () => {
    expect(buildStatusFlow(1, new Map(), [])[0].name).toBe('Status 1')
  })
})
