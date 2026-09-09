import path from 'node:path'

import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  root: path.resolve(__dirname),
  test: {
    setupFiles: ['./test/setup.ts'],
    environment: 'nuxt',
    include: ['app/**/*.spec.ts', 'server/**/*.spec.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      all: true,
      include: ['app/**/*.{ts,vue}', 'server/**/*.ts'],
      exclude: ['**/*.spec.ts'],
      // Ratchet: these are floors, raised as the suite grows and never lowered.
      // The global numbers are dominated by the still-untested Vue pages and API
      // handlers; the per-glob entry pins the modules the first test wave covers
      // so they cannot rot while the global number climbs. See docs/testing.md.
      thresholds: {
        statements: 18,
        branches: 18,
        functions: 13,
        lines: 18,
        'server/utils/{iban,blz,converter,validate,mailFooter,orderStatus,checkoutOptions,countries,links}.ts':
          {
            statements: 95,
            branches: 90,
            functions: 100,
            lines: 95,
          },
        'app/composables/useAdminFormat.ts': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        'app/composables/useInfiniteScroll.ts': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        'app/composables/useModal.ts': {
          statements: 94,
          branches: 88,
          functions: 100,
          lines: 100,
        },
      },
    },
  },
})
