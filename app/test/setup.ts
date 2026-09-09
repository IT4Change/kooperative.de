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

// Vue warnings and errors are bugs, not noise: turn them into test failures.
config.global.config.warnHandler = (msg, _instance, trace) => {
  throw new Error(`[Vue warn]: ${msg}\n${trace}`)
}
config.global.config.errorHandler = (err) => {
  throw err instanceof Error ? err : new Error(String(err))
}
