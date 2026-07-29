'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@/i18n/navigation';
import { Reveal } from '@/components/ui/Reveal';
import { Button } from '@/components/ui/Button';
import { NewsCard } from '@/components/news/NewsCard';
import { api } from '@/lib/api';
import type { Locale } from '@/lib/domain';

/**
 * Лента новостей. Контент приходит из нашей БД уже на нужном языке —
 * раньше тексты лежали в файлах переводов, и добавить новость без деплоя
 * было невозможно.
 *
 * Внешне карточка осталась прежней, но теперь ведёт на страницу новости:
 * размеченный текст в ленту не помещается.
 */
export function NewsList() {
  const t = useTranslations('news');
  const locale = useLocale() as Locale;

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['news', locale],
    queryFn: ({ signal }) => api.news(locale, signal),
    staleTime: 5 * 60_000,
  });

  return (
    <div className="flex flex-col gap-6">
      {isPending && (
        <div className="flex flex-col gap-6" aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className="h-96 animate-pulse rounded-2xl bg-surface-page-surf1" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-2xl bg-surface-page-surf1 p-6 text-center">
          <p className="text-text-disabled">{t('loadError')}</p>
          <Button className="mt-4" onClick={() => refetch()}>
            {t('retry')}
          </Button>
        </div>
      )}

      {data?.posts.length === 0 && (
        <p className="py-10 text-center text-sm text-text-disabled">{t('empty')}</p>
      )}

      {data?.posts.map((post, i) => (
        <Reveal key={post.id} delay={i * 0.06}>
          <Link
            href={`/news/${post.slug}`}
            className="block transition-transform duration-200 hover:-translate-y-0.5"
          >
            <NewsCard
              image={post.image}
              title={post.title}
              excerpt={post.excerpt}
              priority={i === 0}
            />
          </Link>
        </Reveal>
      ))}
    </div>
  );
}
