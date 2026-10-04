import { config } from '@vue/test-utils'
import { vi } from 'vitest'

// Nuxt's app manifest fires a timer that calls $fetch — stub it so the test
// environment does not blow up with "ReferenceError: $fetch is not defined".
// Only when there is nothing there yet: the nuxt environment installs its own
// $fetch, and overwriting it would cut registerEndpoint() off from its server.
// The cast is what makes that check expressible — the global is declared as
// always present.
const globals = globalThis as { $fetch?: typeof $fetch }
globals.$fetch ??= vi.fn().mockResolvedValue({}) as typeof $fetch

// The stub above does not cover the timer's second chance: Nuxt's payload plugin
// schedules that manifest fetch one second after the app is ready
// (nuxt/dist/app/plugins/payload.client.js). A spec file that finishes sooner
// has its environment — and with it $fetch — torn down before the timer fires,
// which surfaces as an unhandled "$fetch is not defined" in whichever file
// happens to be fast. The plugin skips the timer on a slow-2g connection, so
// claim one: there is no manifest to fetch under test anyway.
Object.defineProperty(navigator, 'connection', {
  value: { effectiveType: 'slow-2g' },
  configurable: true,
})

// Vue warnings and errors are bugs, not noise: turn them into test failures.
config.global.config.warnHandler = (msg, _instance, trace) => {
  throw new Error(`[Vue warn]: ${msg}\n${trace}`)
}
config.global.config.errorHandler = (err) => {
  throw err instanceof Error ? err : new Error(String(err))
}
