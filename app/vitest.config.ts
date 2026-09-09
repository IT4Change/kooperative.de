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
      // lowered. Target is 90 %. See docs/testing.md.
      thresholds: {
        statements: 58,
        branches: 53,
        functions: 47,
        lines: 59,
      },
    },
  },
})
