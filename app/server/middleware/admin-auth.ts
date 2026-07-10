import { requireAdminAuth } from '../utils/adminAuth'

/**
 * Guards the whole /admin space — both the Nuxt admin pages (/admin, /admin/...)
 * and the admin data endpoints (/admin/api/...). Keeping data under /admin means
 * page and API share a single Basic-Auth realm, so the browser sends credentials
 * automatically and does not prompt twice.
 */
const ADMIN_PATH = /^\/admin(\/|$|\?)/

export default defineEventHandler((event) => {
  if (ADMIN_PATH.test(event.path)) {
    requireAdminAuth(event)
  }
})
