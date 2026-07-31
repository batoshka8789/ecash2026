import type { MetadataRoute } from 'next';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { news } from '@/server/db/schema';
import { routing } from '@/i18n/routing';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ecash.kz';

/**
 * Пересборка раз в час В РАНТАЙМЕ: без revalidate sitemap запекается на
 * этапе next build, когда Postgres Railway недоступен сборщику, — блок
 * новостей молча выпадал (try/catch), и на проде sitemap уходил без статей.
 */
export const revalidate = 3600;

/** Публичные страницы × локали. Кабинет и авторизация не индексируются. */
const PUBLIC_PATHS = [
  '',
  '/locations',
  '/booking',
  '/individual-rate',
  '/subscribe',
  '/franchise',
  '/news',
];

const localeUrl = (locale: string, path: string) =>
  locale === routing.defaultLocale ? `${SITE_URL}${path || '/'}` : `${SITE_URL}/${locale}${path}`;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries = PUBLIC_PATHS.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: localeUrl(locale, path),
      lastModified: now,
      changeFrequency: path === '' ? ('hourly' as const) : ('daily' as const),
      priority: path === '' ? 1 : 0.7,
    })),
  );

  // Опубликованные статьи: они рендерятся на сервере именно ради поисковиков
  // (см. news/[slug]/page.tsx) — без sitemap этот замысел оставался половинчатым.
  // Сломанная БД не должна ронять sitemap целиком — статика важнее.
  let posts: { slug: string; updatedAt: Date }[] = [];
  try {
    posts = await db
      .select({ slug: news.slug, updatedAt: news.updatedAt })
      .from(news)
      .where(eq(news.status, 'published'));
  } catch {
    posts = [];
  }

  const newsEntries = posts.flatMap((p) =>
    routing.locales.map((locale) => ({
      url: localeUrl(locale, `/news/${p.slug}`),
      lastModified: p.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
  );

  return [...staticEntries, ...newsEntries];
}
