import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e', workers: 1, fullyParallel: false, timeout: 30000,
  use: { browserName: 'chromium', headless: true, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  reporter: [['list'], ['json', { outputFile: '.phase3/browser-results.json' }]],
})
