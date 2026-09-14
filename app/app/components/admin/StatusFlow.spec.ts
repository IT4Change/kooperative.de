import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, it, expect } from 'vitest'

import StatusFlow from './StatusFlow.vue'

import type { FlowStep } from './StatusFlow.vue'

/**
 * The stepper both admin views render. Its one job beyond drawing circles is to
 * keep the numbering stable: the confirmation step occupies slot 1 even for an
 * order that never had one, so "In Bearbeitung" reads as step 2 everywhere.
 */
function step(over: Partial<FlowStep> = {}): FlowStep {
  return { id: 1, name: 'In Bearbeitung', state: 'upcoming', visitedAt: null, ...over }
}

const FLOW: FlowStep[] = [
  { id: -1, name: 'Bestätigung', state: 'skipped', visitedAt: null, note: 'entfällt' },
  step({ id: 1, state: 'done', visitedAt: '2026-03-04T10:00:00' }),
  step({ id: 4, name: 'Vorkasse erwartet', state: 'current' }),
  step({ id: 2, name: 'Versandbereit' }),
]

async function mount(steps: FlowStep[] = FLOW) {
  return mountSuspended(StatusFlow, { props: { steps } })
}

describe('AdminStatusFlow', () => {
  it('numbers the steps by position, not by status id', async () => {
    const wrapper = await mount()

    // The skipped step still counts, which is the whole point.
    expect(wrapper.get('[data-testid="flow-step-1"]').text()).toBe('1')
    expect(wrapper.get('[data-testid="flow-step-3"]').text()).toBe('3')
  })

  it('replaces the number with a tick once a step is done', async () => {
    const wrapper = await mount()

    const done = wrapper.get('[data-testid="flow-step-2"]')
    expect(done.find('svg').exists()).toBe(true)
    expect(done.text()).toBe('')
  })

  it('greys a skipped step out and says it does not apply', async () => {
    const wrapper = await mount()

    const skipped = wrapper.get('[data-testid="flow-step-1"]')
    expect(skipped.classes().join(' ')).toContain('border-dashed')
    expect(wrapper.text()).toContain('entfällt')
  })

  it('shows the date of a step that was actually reached', async () => {
    const wrapper = await mount()

    expect(wrapper.text()).toContain('04.03.2026')
  })

  it('keeps the date off an upcoming step', async () => {
    const wrapper = await mount([step({ state: 'upcoming', visitedAt: '2026-03-04T10:00:00' })])

    // A date on a step the order has not reached would read as a promise.
    expect(wrapper.text()).not.toContain('04.03.2026')
  })

  it('highlights the current step', async () => {
    const wrapper = await mount()

    expect(wrapper.get('[data-testid="flow-step-3"]').classes().join(' ')).toContain('ring-4')
  })

  it('marks an upcoming step as neither done nor skipped', async () => {
    const wrapper = await mount()

    const upcoming = wrapper.get('[data-testid="flow-step-4"]')
    expect(upcoming.classes().join(' ')).toContain('border-gray-300')
    expect(upcoming.classes().join(' ')).not.toContain('border-dashed')
  })

  it('draws no connector after the last step', async () => {
    const wrapper = await mount([step(), step({ id: 4 })])

    expect(wrapper.findAll('.flex-1')).toHaveLength(1)
  })

  it('renders whatever the page adds below the stepper', async () => {
    const wrapper = await mountSuspended(StatusFlow, {
      props: { steps: FLOW },
      slots: { default: () => 'Hinweis zur Bestellung' },
    })

    expect(wrapper.text()).toContain('Hinweis zur Bestellung')
  })
})
