import { requireAdminAuth } from '../utils/adminAuth'

/**
 * Guards the whole /admin space — both the Nuxt admin pages (/admin, /admin/...)
 * and the admin data endpoints (/admin/api/...). Keeping data under /admin means
 * page and API share a single Basic-Auth realm, so the browser sends credentials
 * automatically and does not prompt twice.
 */
const ADMIN_PATH = /^\/admin(\/|$|\?)/
const ADMIN_API_PATH = /^\/admin\/api(\/|$|\?)/

export default defineEventHandler((event) => {
  if (!ADMIN_PATH.test(event.path)) return

  // Nitro decides between a JSON error and a rendered Nuxt error page via its
  // isJsonRequest() heuristic, which only recognises API routes by a leading
  // "/api/". Ours live under "/admin/api/" (see above), so any client sending
  // `Accept: text/html` — a browser, a crawler, Playwright's request context —
  // used to get the HTML error page for a 401. Rendering it made the Vue router
  // resolve a path that has no page route, logging "No match found" twice per
  // request. Stating what these endpoints actually serve fixes the response
  // content type and the log noise in one go, for every error on the path, not
  // just the auth failure below.
  if (ADMIN_API_PATH.test(event.path)) {
    event.node.req.headers.accept = 'application/json'
  }

  requireAdminAuth(event)
})
