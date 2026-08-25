import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async () => {
    const t = (key: string) => `перевод:${key}`;
    t.has = () => false;
    return t;
  }),
}));

vi.mock('@/i18n/routing', () => ({
  routing: { locales: ['ru', 'en'], defaultLocale: 'ru' },
}));

/**
 * SITE_URL читается из process.env при импорте модуля — значение
 * фиксируется один раз. Чтобы проверить оба сценария (переменная задана /
 * пуста), модуль нужно перезагружать через resetModules между кейсами.
 */
describe('pageMetadata — SITE_URL из окружения', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('переменная не задана вовсе — используется запасной домен', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', undefined as unknown as string);
    const { pageMetadata } = await import('./metadata');
    const meta = await pageMetadata('ru', 'home', '/');
    expect(String(meta.metadataBase)).toBe('https://ecash.kz/');
  });

  it('переменная задана пустой строкой (build-аргумент объявлен, но не заполнен) — не падает', async () => {
    // ровно симптом из прод-инцидента: TypeError: Invalid URL на new URL('')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    const { pageMetadata } = await import('./metadata');
    await expect(pageMetadata('ru', 'home', '/')).resolves.toMatchObject({
      metadataBase: new URL('https://ecash.kz'),
    });
  });

  it('переменная задана нормально — используется она, а не запасной домен', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://ecash-partner.example');
    const { pageMetadata } = await import('./metadata');
    const meta = await pageMetadata('ru', 'home', '/');
    expect(String(meta.metadataBase)).toBe('https://ecash-partner.example/');
  });
});
