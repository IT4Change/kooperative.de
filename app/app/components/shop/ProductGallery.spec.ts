import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, it, expect } from 'vitest'

import ProductGallery from './ProductGallery.vue'

/** The image carousel of a product card. Wraps around at both ends. */
const IMAGES = ['a.jpg', 'b.jpg', 'c.jpg']

const mount = async (images: string[], size?: 'sm' | 'lg') =>
  mountSuspended(ProductGallery, { props: { images, ...(size ? { size } : {}) } })

/** The arrow buttons, in DOM order: previous, next. */
const arrows = (w: Awaited<ReturnType<typeof mount>>) => w.findAll('button')

describe('with several images', () => {
  it('starts on the first one', async () => {
    const wrapper = await mount(IMAGES)

    expect(wrapper.html()).toContain('a.jpg')
  })

  it('steps forward', async () => {
    const wrapper = await mount(IMAGES)

    await arrows(wrapper)[1].trigger('click')

    expect(wrapper.html()).toContain('b.jpg')
  })

  it('wraps around at the end', async () => {
    const wrapper = await mount(IMAGES)
    const next = arrows(wrapper)[1]

    await next.trigger('click')
    await next.trigger('click')
    await next.trigger('click')

    expect(wrapper.html()).toContain('a.jpg')
  })

  it('wraps around backwards from the first image', async () => {
    const wrapper = await mount(IMAGES)

    await arrows(wrapper)[0].trigger('click')

    // Modulo arithmetic on a negative index is the classic place to get this wrong.
    expect(wrapper.html()).toContain('c.jpg')
  })
})

describe('with a single image', () => {
  it('shows no arrows', async () => {
    const wrapper = await mount(['a.jpg'])

    expect(arrows(wrapper)).toHaveLength(0)
  })
})

describe('without images', () => {
  it('renders a placeholder rather than a broken image', async () => {
    const wrapper = await mount([])

    expect(wrapper.html()).not.toContain('<img')
  })
})

describe('sizes', () => {
  it('renders the large variant differently from the small one', async () => {
    const small = await mount(IMAGES)
    const large = await mount(IMAGES, 'lg')

    expect(large.html()).not.toBe(small.html())
  })
})
