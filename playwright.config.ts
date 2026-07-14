import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results/iterations/v0.1/results',
  fullyParallel: false,
  reporter: [['list'], ['json', { outputFile: 'test-results/iterations/v0.1/reports/browser-results.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on',
    screenshot: 'on',
    video: 'off',
  },
  projects: [
    { name: 'desktop', grep: /desktop:/, use: { browserName: 'chromium', channel: 'chrome', ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } },
    { name: 'mobile', grep: /mobile:/, use: { browserName: 'chromium', channel: 'chrome', ...devices['iPhone 13'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: 'npm run dev -- --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
