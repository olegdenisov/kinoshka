import { defineConfig, devices } from '@playwright/test'

// Реальный API (не MSW-мок в браузере), production preview-сборка (vite
// preview над dist/), два projects — desktop chromium (весь e2e/, кроме
// e2e/mobile/) и Mobile Safari (только e2e/mobile/, urезанный smoke-набор
// на /, /search, /movie/:id). См. docs/plans/20260912-e2e-playwright-axe.md.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  expect: {
    // дефолтные 5s — риск флейков на живом API + холодном CI-раннере.
    timeout: 10_000,
  },
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  // webServer намеренно НЕ билдит — билд отдельный явный шаг (make build-only)
  // перед playwright test, и локально, и в CI. Стартует один раз на весь
  // прогон, не на каждый ретрай.
  webServer: {
    command: 'pnpm exec vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: '**/mobile/**',
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13'] },
      testDir: './e2e/mobile',
    },
  ],
})
