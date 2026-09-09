import path from 'node:path'

import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  root: path.resolve(__dirname),
  test: {
    setupFiles: ['./test/setup.ts'],
    environment: 'nuxt',
    include: ['app/**/*.spec.ts', 'server/**/*.spec.ts'],
    // Every spec file gets its own Nuxt environment, which takes over a second
    // to build. Under load that queue makes the default 10 s hook budget run
    // out before setup even starts — raise it rather than let a busy machine
    // fail the suite. Override with TEST_HOOK_TIMEOUT if a runner is slower yet.
    hookTimeout: Number(process.env.TEST_HOOK_TIMEOUT ?? 60_000),
    coverage: {
      reporter: ['text', 'json', 'html'],
      all: true,
      include: ['app/**/*.{ts,vue}', 'server/**/*.ts'],
      exclude: ['**/*.spec.ts'],
      // One floor for the whole project, raised as the suite grows and never
      // lowered. See docs/testing.md.
      //
      // Branches sit one point below the rest, not for want of tests: twelve
      // counters in app/pages/shop/[...path].vue never register at all (both
      // sides read 0) although the suite renders each of them. They are an
      // artefact of the v8 → istanbul remapping for that SFC template.
      thresholds: {
        statements: 100,
        branches: 99,
        functions: 100,
        lines: 100,
      },
    },
  },
})
