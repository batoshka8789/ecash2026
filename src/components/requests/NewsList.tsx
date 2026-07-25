'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { SidebarLayout } from '@/components/profile/SidebarLayout';
import { Reveal } from '@/components/ui/Reveal';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';

/** Новости — из нашей БД (REST-эндпоинта новостей у Ecash нет), тексты из переводов. */
export function NewsList() {
  const t = useTranslations('news');
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['news'],
    queryFn: ({ signal }) => api.news(signal),
    staleTime: 5 * 60_000,
  });

  return (
    <SidebarLayout>
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
            <article className="rounded-2xl bg-surface-page-surf1 p-4 sm:rounded-3xl sm:p-6">
              <div className="relative h-56 w-full overflow-hidden rounded-2xl sm:h-72">
                <Image
                  src={post.image}
                  alt={t(`${post.key}.title`)}
                  fill
                  sizes="(max-width: 768px) 100vw, 720px"
                  className="object-cover"
                  priority={i === 0}
                />
              </div>
              <h2 className="mt-6 text-lg font-bold text-text-default sm:text-2xl">
                {t(`${post.key}.title`)}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-text-disabled">
                {t(`${post.key}.text`)}
              </p>
            </article>
          </Reveal>
        ))}
      </div>
    </SidebarLayout>
  );
}
