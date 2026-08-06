import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { db } from '@/server/db/client';
import { news } from '@/server/db/schema';
import { toPublicPost } from '@/server/db/news';
import { routing, type Locale } from '@/i18n/routing';
import { Link } from '@/i18n/navigation';
import { Icon } from '@/components/ui/Icon';
import { RichText } from '@/components/ui/RichText';
import { NewsShell } from '@/components/news/NewsShell';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ecash.kz';

/**
 * Всегда свежий рендер. Без этого Next кешировал ПЕРВЫЙ рендер страницы
 * навсегда (маршрут без динамических API считается статическим), и это
 * давало два бага сразу: правки редактора после публикации не доходили до
 * читателей («список обновился, статья — нет»), а /en|kk|zh-версия,
 * открытая до того как автоперевод докатился, замерзала с русским
 * фолбэком. Одна выборка из своей БД на просмотр статьи — дёшево.
 */
export const dynamic = 'force-dynamic';

/**
 * Страница новости. Рендерится на сервере: текст должен быть в HTML для
 * поисковиков, а размеченный контент в ленту не помещается.
 */
async function loadPost(slug: string, locale: Locale) {
  const [row] = await db
    .select()
    .from(news)
    .where(and(eq(news.slug, slug), eq(news.status, 'published')));
  return row ? toPublicPost(row, locale, true) : null;
}

export default async function NewsPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const post = await loadPost(slug, locale as Locale);
  if (!post) notFound();

  const t = await getTranslations({ locale, namespace: 'news' });
  const published = new Date(post.publishedAt).toLocaleDateString(
    locale === 'kk' ? 'kk-KZ' : locale === 'en' ? 'en-US' : locale === 'zh' ? 'zh-CN' : 'ru-RU',
    { day: '2-digit', month: 'long', year: 'numeric' },
  );

  return (
    <NewsShell>
      <article className="mx-auto flex max-w-3xl flex-col">
        <Link
          href="/news"
          className="inline-flex w-fit items-center gap-2 text-sm text-text-disabled transition-colors hover:text-text-default"
        >
          <Icon name="arrow_back" size={18} />
          {t('backToList')}
        </Link>

        {post.image && (
          <div className="relative mt-5 h-56 w-full overflow-hidden rounded-2xl bg-surface-page-surf2 sm:h-80 sm:rounded-3xl">
            <Image
              src={post.image}
              alt={post.title}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              style={{ objectPosition: post.imageFocus }}
              className="object-cover"
              priority
            />
          </div>
        )}

        <h1 className="mt-6 text-2xl font-bold text-text-default sm:text-[32px]">{post.title}</h1>
        <time dateTime={post.publishedAt} className="mt-2 text-sm text-text-disabled">
          {published}
        </time>

        <RichText source={post.body ?? ''} className="mt-4 pb-6" />
      </article>
    </NewsShell>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await loadPost(slug, locale as Locale);
  if (!post) return {};

  const path = `/news/${slug}`;
  const canonical = locale === routing.defaultLocale ? path : `/${locale}${path}`;

  return {
    title: `${post.title} — ecash`,
    description: post.excerpt,
    alternates: {
      canonical: `${SITE_URL}${canonical}`,
      languages: {
        ...Object.fromEntries(
          routing.locales.map((l) => [
            l,
            `${SITE_URL}${l === routing.defaultLocale ? path : `/${l}${path}`}`,
          ]),
        ),
        // x-default — как у остальных страниц (pageMetadata в lib/metadata.ts)
        'x-default': `${SITE_URL}${path}`,
      },
    },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.publishedAt,
      ...(post.image.startsWith('/') ? { images: [`${SITE_URL}${post.image}`] } : {}),
    },
  };
}
