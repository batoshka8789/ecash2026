import 'server-only';
import type {
  Locale,
  NewsAdminPost,
  NewsPost,
  NewsStatus,
  NewsTranslation,
  NewsTranslations,
} from '@/lib/domain';
import { richTextToPlain } from '@/lib/richtext';
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
    status: (row.status === 'published' ? 'published' : 'draft') as NewsStatus,
    translations: normalizeTranslations(row.translations),
    publishedAt: row.publishedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Транслитерация для адреса новости. Заголовки русские, поэтому без неё slug
 * получался бы пустым; казахские буквы добавлены по той же причине.
 */
const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'shch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  ә: 'a', ғ: 'g', қ: 'k', ң: 'n', ө: 'o', ұ: 'u', ү: 'u', һ: 'h', і: 'i',
};

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .split('')
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}
