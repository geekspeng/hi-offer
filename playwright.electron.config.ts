import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'src/test/e2e-electron',
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    trace: 'on-first-retry'
  }
})
