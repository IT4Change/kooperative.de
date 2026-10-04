import path from 'node:path'

import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  root: path.resolve(__dirname),
  test: {
    setupFiles: ['./test/setup.ts'],
    // Fictitious company details for the mail footer (server/utils/mailFooter.ts).
    // The real ones live in the server environment only — this repository is public.
    env: {
      COMPANY_NAME: 'Musterfirma GmbH',
      COMPANY_STREET: 'Musterweg 1',
      COMPANY_CITY: '12345 Musterstadt',
      COMPANY_MANAGER: 'Max Mustermann',
      COMPANY_REGISTER: 'Amtsgericht Musterstadt, HRB 12345',
      COMPANY_EMAIL: 'info@example.org',
    },
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
      // lowered. Everything is covered, so anything below 100 means a gap.
      // See docs/testing.md.
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
})
