import { createHash } from 'node:crypto'

/**
 * A weak ETag over a response body.
 *
 * Weak by necessity rather than by choice. nginx rewrites a strong ETag to its
 * weak form the moment it compresses a response — verified against the asset
 * pipeline, where the same file answers with `"14a3-…"` uncompressed and
 * `W/"14a3-…"` under gzip — and the browser echoes back whatever it received.
 * Emitting a strong ETag here would therefore never match on return: the
 * comparison would fail on every revalidation and cost a full re-download,
 * without anything looking broken. It is also the honest label, since a strong
 * ETag promises byte-identity that compression does not preserve.
 */
export function weakEtag(body: string): string {
  return `W/"${createHash('sha1').update(body).digest('base64url')}"`
}

/**
 * Whether an If-None-Match header covers the given ETag.
 *
 * The header may carry a list, and its entries may arrive in either strength
 * form depending on what rewrote them along the way, so the W/ prefix is
 * ignored. That is the weak comparison of RFC 9110 — and the only one that
 * carries meaning for a response some proxy in the chain may have compressed.
 */
export function etagMatches(header: string | undefined, etag: string): boolean {
  if (!header) return false
  if (header.trim() === '*') return true
  const strip = (value: string) => value.trim().replace(/^W\//, '')
  const target = strip(etag)
  return header.split(',').some((candidate) => strip(candidate) === target)
}
