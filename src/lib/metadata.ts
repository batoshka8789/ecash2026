import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';

/**
 * Локализованные метаданные страницы: title/description из messages.meta,
 * canonical + hreflang на все локали (localePrefix: 'as-needed' —
 * ru без префикса, /en и /kk с префиксом).
 */

// `||`, не `??`: пустая строка из окружения (переменная объявлена в
// build-аргументах, но не заполнена) раньше проходила мимо запасного
// значения и падала на new URL('') ниже — TypeError: Invalid URL.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://ecash.kz';

type MetaKey =
  | 'home'
  | 'locations'
  | 'booking'
  | 'individualRate'
  | 'subscribe'
  | 'franchise'
  | 'login'
  | 'signup'
  | 'recovery'
  | 'profile'
  | 'notifications'
  | 'news'
  | 'requests'
  | 'consent';

const localePath = (locale: string, path: string) =>
  locale === routing.defaultLocale ? path || '/' : `/${locale}${path}`;

export async function pageMetadata(
  locale: string,
  key: MetaKey,
  path: string,
  opts?: { noIndex?: boolean },
): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'meta' });

  const title = t(`${key}.title`);
  // не у всех страниц есть description (кабинет/авторизация)
  const description = t.has(`${key}.description`) ? t(`${key}.description`) : undefined;

  const languages = Object.fromEntries(
    routing.locales.map((l) => [l, `${SITE_URL}${localePath(l, path)}`]),
  );

  return {
    title,
    description,
    metadataBase: new URL(SITE_URL),
    alternates: {
      canonical: `${SITE_URL}${localePath(locale, path)}`,
      languages: { ...languages, 'x-default': `${SITE_URL}${path || '/'}` },
    },
    openGraph: {
      title,
      description,
      siteName: t('siteName'),
      locale,
      type: 'website',
      url: `${SITE_URL}${localePath(locale, path)}`,
    },
    twitter: { card: 'summary_large_image', title, description },
    ...(opts?.noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}
