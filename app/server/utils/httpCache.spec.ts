// @vitest-environment node
import { describe, it, expect } from 'vitest'

import { weakEtag, etagMatches } from './httpCache'

/**
 * Revalidation only pays off if both ends of the comparison survive the proxy
 * chain. nginx rewrites a strong ETag to its weak form when it compresses, so
 * these two functions exist to make the round trip match anyway.
 */

describe('weakEtag', () => {
  it('is stable for identical bodies', () => {
    expect(weakEtag('{"a":1}')).toBe(weakEtag('{"a":1}'))
  })

  it('differs for different bodies', () => {
    expect(weakEtag('{"a":1}')).not.toBe(weakEtag('{"a":2}'))
  })

  it('is marked weak, because compression does not preserve byte-identity', () => {
    expect(weakEtag('body')).toMatch(/^W\/"[\w-]+"$/)
  })
})

describe('etagMatches', () => {
  const etag = weakEtag('body')

  it('matches the ETag echoed back verbatim', () => {
    expect(etagMatches(etag, etag)).toBe(true)
  })

  it('matches after a proxy stripped the weak marker', () => {
    // The mirror image of nginx adding one: either rewrite must still revalidate.
    expect(etagMatches(etag.replace('W/', ''), etag)).toBe(true)
  })

  it('matches an entry inside a list', () => {
    expect(etagMatches(`W/"other", ${etag}`, etag)).toBe(true)
  })

  it('matches the wildcard', () => {
    expect(etagMatches('*', etag)).toBe(true)
  })

  it('does not match a different ETag', () => {
    expect(etagMatches(weakEtag('other'), etag)).toBe(false)
  })

  it('does not match when the header is absent', () => {
    expect(etagMatches(undefined, etag)).toBe(false)
  })
})
