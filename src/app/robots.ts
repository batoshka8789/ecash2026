import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';

// `||`, не `??`: пустая строка из окружения не должна проходить мимо запасного значения
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://ecash.kz';

/** Приватные разделы; /news стали публичными и индексируются. */
const PRIVATE_PATHS = ['/profile', '/notifications', '/requests', '/admin'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Правила robots — префиксные, поэтому локализованные URL
        // (/en/profile, /kk/requests…) нужно закрывать отдельно: строка
        // '/profile' матчит только дефолтную локаль без префикса.
        disallow: [
          '/api/',
          ...PRIVATE_PATHS.flatMap((p) => [
            p,
            ...routing.locales
              .filter((l) => l !== routing.defaultLocale)
              .map((l) => `/${l}${p}`),
          ]),
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
