/**
 * Globals for server-side unit tests.
 *
 * Nitro auto-imports the h3 helpers into everything under server/, so the modules
 * there reference `createError`, `getCookie` & co. without importing them. Under
 * vitest there is no Nitro, so the same helpers are installed as globals here.
 * Import this file from any spec that exercises a server module:
 *
 *   // @vitest-environment node
 *   import '../../test/setup-server'
 *
 * The real h3 implementations are used rather than stubs: cookie signing, header
 * handling and error shapes are part of what the tests are checking, and a stub
 * would only prove that the stub works.
 */
import {
  createError,
  defineEventHandler,
  deleteCookie,
  getCookie,
  getQuery,
  getRequestHeader,
  getRequestIP,
  getRequestURL,
  getRouterParam,
  readBody,
  setCookie,
  setResponseHeader,
  setResponseStatus,
} from 'h3'

Object.assign(globalThis, {
  createError,
  defineEventHandler,
  deleteCookie,
  getCookie,
  getQuery,
  getRequestHeader,
  getRequestIP,
  getRequestURL,
  getRouterParam,
  readBody,
  setCookie,
  setResponseHeader,
  setResponseStatus,
  // Nitro's plugin wrapper is a plain pass-through at runtime.
  defineNitroPlugin: <T>(handler: T) => handler,
})

/**
 * `useRuntimeConfig` cannot be handled here: Nuxt's auto-import transform routes
 * it to `#app/nuxt`, and `vi.mock` only hoists inside the file that calls it —
 * not through an import. A spec that needs it declares the mock itself:
 *
 *   vi.mock('#app/nuxt', async (importOriginal) => ({
 *     ...(await importOriginal<Record<string, unknown>>()),
 *     useRuntimeConfig: () => globalThis.useRuntimeConfig(),
 *   }))
 *
 * See server/utils/db.spec.ts.
 */
