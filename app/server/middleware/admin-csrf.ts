import { isSameOriginRequest } from '../utils/sameOrigin'

/**
 * Refuses state-changing requests to the admin that come from another site.
 * Runs after admin-auth (alphabetical order), so it only ever sees requests
 * that carry valid credentials — exactly the ones a forged request would ride
 * on. Reads (GET/HEAD/OPTIONS) change nothing and stay untouched, as do the
 * pages themselves.
 */
const ADMIN_PATH = /^\/admin(\/|$|\?)/
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export default defineEventHandler((event) => {
  if (!ADMIN_PATH.test(event.path) || SAFE_METHODS.has(event.method)) return
  if (!isSameOriginRequest(event)) {
    throw createError({ statusCode: 403, statusMessage: 'Anfrage von fremder Seite abgelehnt' })
  }
})
