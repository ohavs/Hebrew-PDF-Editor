import { defineConfig, devices } from '@playwright/test'

/**
 * E2E suite runs against the production build — the same bundle that ships,
 * so build-only problems (stale chunks, missing polyfills) are caught too.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false, // the tests share one dev server and one browser profile
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || undefined,
      // Containers commonly run the suite as root, where the sandbox refuses
      // to start. This is the test browser only.
      args: ['--no-sandbox'],
    },
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 950 } },
    },
    {
      // Phone-shaped Chromium rather than the iPhone preset: that preset
      // defaults to WebKit, which isn't installed here, and touch emulation
      // is what these tests actually need.
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    // Bind IPv4 explicitly: on runners where `localhost` resolves to ::1
    // first, the default binding is IPv6-only and the 127.0.0.1 health check
    // never succeeds — the server "starts" but Playwright times out.
    command: 'npx vite preview --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
