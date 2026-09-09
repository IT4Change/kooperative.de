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
      // One floor for the whole project, raised as the suite grows and never
      // lowered. See docs/testing.md.
      thresholds: {
        statements: 96,
        branches: 89,
        functions: 94,
        lines: 97,
      },
    },
  },
})
