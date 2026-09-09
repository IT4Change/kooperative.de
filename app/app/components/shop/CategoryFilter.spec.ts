import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, it, expect } from 'vitest'

import CategoryFilter from './CategoryFilter.vue'

import type { Category } from '~/data/products'

/**
 * The category bar. Two rows: top-level categories, and — once one of them is
 * active — its children. Categories without products are greyed out so the
 * customer cannot click their way into an empty result.
 */
const CATEGORIES: Category[] = [
  { slug: 'lebensmittel', name: 'Lebensmittel', description: '', parentSlug: null },
  { slug: 'lebensmittel/oele', name: 'Öle', description: '', parentSlug: 'lebensmittel' },
  { slug: 'lebensmittel/brot', name: 'Brot', description: '', parentSlug: 'lebensmittel' },
  { slug: 'papeterie', name: 'Papeterie', description: '', parentSlug: null },
  { slug: 'leer', name: 'Leer', description: '', parentSlug: null },
]

const COUNTS = {
  lebensmittel: 3,
  'lebensmittel/oele': 1,
  'lebensmittel/brot': 2,
  papeterie: 1,
}

const mount = async (selected: string | null) =>
  mountSuspended(CategoryFilter, {
    props: { selected, counts: COUNTS, categories: CATEGORIES, total: 4 },
  })

const topRow = (w: Awaited<ReturnType<typeof mount>>) =>
  w.findAll('.flex.flex-wrap.gap-2')[0].findAll('button')
const subRow = (w: Awaited<ReturnType<typeof mount>>) => w.findAll('.border-l-2 button')

describe('top level', () => {
  it('lists every top-level category with its count', async () => {
    const wrapper = await mount(null)
    const labels = topRow(wrapper).map((b) => b.text().replace(/\s+/g, ' '))

    expect(labels).toContain('Lebensmittel 3')
    expect(labels).toContain('Papeterie 1')
  })

  it('shows the total on the "Alle" button', async () => {
    const wrapper = await mount(null)

    expect(topRow(wrapper).at(-1)?.text()).toContain('4')
  })

  it('disables a category without products', async () => {
    const wrapper = await mount(null)
    const empty = topRow(wrapper).find((b) => b.text().includes('Leer'))

    // Clicking it would produce an empty grid with no way to tell why.
    expect(empty?.attributes('disabled')).toBeDefined()
  })

  it('emits the chosen slug', async () => {
    const wrapper = await mount(null)

    await topRow(wrapper)
      .find((b) => b.text().includes('Papeterie'))!
      .trigger('click')

    expect(wrapper.emitted('select')?.[0]).toStrictEqual(['papeterie'])
  })

  it('emits null for "Alle"', async () => {
    const wrapper = await mount('papeterie')

    await topRow(wrapper).at(-1)!.trigger('click')

    expect(wrapper.emitted('select')?.[0]).toStrictEqual([null])
  })

  it('does not emit for a disabled category', async () => {
    const wrapper = await mount(null)

    await topRow(wrapper)
      .find((b) => b.text().includes('Leer'))!
      .trigger('click')

    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('marks the parent as active when a child is selected', async () => {
    const wrapper = await mount('lebensmittel/oele')
    const parent = topRow(wrapper).find((b) => b.text().includes('Lebensmittel'))

    expect(parent?.classes().join(' ')).toContain('bg-[#00af8c]')
  })
})

describe('subcategories', () => {
  it('stays hidden while no category is chosen', async () => {
    const wrapper = await mount(null)

    expect(subRow(wrapper)).toHaveLength(0)
  })

  it('appears for a category that has children', async () => {
    const wrapper = await mount('lebensmittel')
    const labels = subRow(wrapper).map((b) => b.text().replace(/\s+/g, ' '))

    expect(labels).toContain('Öle 1')
    expect(labels).toContain('Brot 2')
  })

  it('stays hidden for a category without children', async () => {
    const wrapper = await mount('papeterie')

    expect(subRow(wrapper)).toHaveLength(0)
  })

  it('emits the child slug', async () => {
    const wrapper = await mount('lebensmittel')

    await subRow(wrapper)
      .find((b) => b.text().includes('Öle'))!
      .trigger('click')

    expect(wrapper.emitted('select')?.[0]).toStrictEqual(['lebensmittel/oele'])
  })

  it('offers a way back to the whole parent category', async () => {
    const wrapper = await mount('lebensmittel/oele')
    const all = subRow(wrapper).at(-1)

    // Distinguishable from the other "Alle" for a screen reader.
    expect(all?.attributes('aria-label')).toBe('Alle Lebensmittel')
    await all!.trigger('click')
    expect(wrapper.emitted('select')?.[0]).toStrictEqual(['lebensmittel'])
  })

  it('names the top-level "Alle" distinctly', async () => {
    const wrapper = await mount(null)

    expect(topRow(wrapper).at(-1)?.attributes('aria-label')).toBe('Alle Kategorien')
  })
})
