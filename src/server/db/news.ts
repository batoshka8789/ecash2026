import 'server-only';
import type {
  Locale,
  NewsAdminPost,
  NewsPost,
  NewsStatus,
  NewsTranslation,
  NewsTranslations,
} from '@/lib/domain';
import { toImageFocus } from '@/lib/domain';
import { richTextToPlain } from '@/lib/richtext';
import { slugify } from '@/lib/slug';
import type { news } from './schema';

type NewsRow = typeof news.$inferSelect;

/** Длина автоматической выжимки, когда админ не задал её вручную. */
const EXCERPT_LIMIT = 220;

const LOCALES: Locale[] = ['ru', 'en', 'kk', 'zh'];

/**
 * jsonb в рантайме может содержать что угодно (ручная правка данных, старая
 * запись, миграция) — `$type<>()` у drizzle это лишь подсказка компилятору.
 * Нормализуем на выходе из БД, как это уже делает profileFromRow для тегов.
 */
export function normalizeTranslations(value: unknown): NewsTranslations {
  if (!value || typeof value !== 'object') return {};
  const src = value as Record<string, unknown>;
  const out: NewsTranslations = {};

  for (const locale of LOCALES) {
    const node = src[locale];
    if (!node || typeof node !== 'object') continue;
    const t = node as Record<string, unknown>;
    const title = typeof t.title === 'string' ? t.title : '';
    if (!title) continue;
    out[locale] = {
      title,
      excerpt: typeof t.excerpt === 'string' ? t.excerpt : '',
      body: typeof t.body === 'string' ? t.body : '',
    };
  }
  return out;
}

/** Перевод для локали с фолбэком на русский — правило живёт в одном месте. */
export function pickTranslation(
  translations: NewsTranslations,
  locale: Locale,
): NewsTranslation | null {
  return translations[locale] ?? translations.ru ?? null;
}

/** Публичный пост: один уже выбранный язык, без остальных переводов. */
export function toPublicPost(row: NewsRow, locale: Locale, withBody: boolean): NewsPost | null {
  const translations = normalizeTranslations(row.translations);
  const t = pickTranslation(translations, locale);
  if (!t) return null;

  return {
    id: row.id,
    slug: row.slug,
    image: row.image,
    imageFocus: toImageFocus(row.imageFocus),
    title: t.title,
    excerpt: t.excerpt || richTextToPlain(t.body, EXCERPT_LIMIT),
    ...(withBody ? { body: t.body } : {}),
    publishedAt: row.publishedAt.toISOString(),
  };
}

/** Полная запись для админки: все переводы и черновики. */
export function toAdminPost(row: NewsRow): NewsAdminPost {
  return {
    id: row.id,
    slug: row.slug,
    image: row.image,
    imageFocus: toImageFocus(row.imageFocus),
    status: (row.status === 'published' ? 'published' : 'draft') as NewsStatus,
    translations: normalizeTranslations(row.translations),
    publishedAt: row.publishedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export { slugify };
