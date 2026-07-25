import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ecash.kz';

/** Публичные страницы × локали. Кабинет и авторизация не индексируются. */
const PUBLIC_PATHS = ['', '/locations', '/booking', '/individual-rate', '/subscribe', '/franchise'];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PUBLIC_PATHS.flatMap((path) =>
    routing.locales.map((locale) => ({
      url:
        locale === routing.defaultLocale
          ? `${SITE_URL}${path || '/'}`
          : `${SITE_URL}/${locale}${path}`,
      lastModified: now,
      changeFrequency: path === '' ? ('hourly' as const) : ('daily' as const),
      priority: path === '' ? 1 : 0.7,
    })),
  );
}
