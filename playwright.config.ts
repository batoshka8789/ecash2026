import { defineConfig } from '@playwright/test';

/**
 * E2E против уже запущенного сервера: `npm run dev` (порт 3000) или
 * продакшен-сборки. Другой адрес — через BASE_URL.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    locale: 'ru-RU',
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
