/**
 * Globals for server-side unit tests.
 *
 * Nitro auto-imports the h3 helpers into everything under server/, so the modules
 * there reference `createError`, `getRequestURL` & co. without importing them.
 * Under vitest there is no Nitro, so the same helpers are installed as globals
 * here. Import this file from any spec that exercises a server module:
 *
 *   // @vitest-environment node
 *   import '../../test/setup-server'
 */
import { createError, getRequestURL } from 'h3'

globalThis.createError = createError
globalThis.getRequestURL = getRequestURL
