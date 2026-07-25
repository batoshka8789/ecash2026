import { defineConfig } from '@playwright/test';

/**
 * E2E против уже запущенного дев-сервера (порт 3100) или продакшен-сборки.
 * BASE_URL переопределяется в CI.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3100',
    locale: 'ru-RU',
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
