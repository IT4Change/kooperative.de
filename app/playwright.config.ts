import { defineConfig } from '@playwright/test'
import { config as loadEnv } from 'dotenv'

// Full-stack E2E. Requires the throwaway backend stack to be up:
//
//   docker compose -f ../docker-compose.e2e.yml up -d --wait
//
// .env.e2e points at that stack (shifted ports) and is loaded here so both the
// Nuxt server spawned below and the tests' own DB/maildev helpers agree on it.
loadEnv({ path: '.env.e2e', override: true })

const PORT = 3100
const BASE_URL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './e2e',
  // The suite shares one seeded database, so the specs must not interleave.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  // Reset the database once, before any spec runs.
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    reducedMotion: 'reduce',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    // Deliberately the production artifact, not `nuxt dev`: the dev server loads
    // Nuxt DevTools after hydration, which re-renders the page underneath the
    // test and made interactions flaky. It also means the suite exercises what
    // actually gets deployed.
    command: 'npx nuxt build && node .output/server/index.mjs',
    url: BASE_URL,
    env: { PORT: String(PORT), HOST: '127.0.0.1' },
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
