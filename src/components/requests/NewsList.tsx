'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
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
      <div className="flex flex-col gap-1">
        {isPending && (
          <div className="flex flex-col gap-1" aria-hidden>
            {[0, 1].map((i) => (
              <div key={i} className="h-96 animate-pulse rounded-[28px] bg-surface-page-surf1" />
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-[28px] border border-stroke-surface1 bg-surface-page-surf1 p-8 text-center">
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
            {/* ниже xl карточки идут в край экрана: у первой (под полосой
                навигации) верхние углы не скруглены — radius 0 0 28 28 */}
            <article
              className={clsx(
                'rounded-[28px] border border-stroke-surface1 bg-surface-page-surf1 p-4 md:p-8',
                i === 0 && 'max-xl:rounded-t-none',
              )}
            >
              <div className="relative h-[140px] w-full overflow-hidden rounded-2xl md:h-[260px]">
                <Image
                  src={post.image}
                  alt={t(`${post.key}.title`)}
                  fill
                  sizes="(max-width: 768px) 100vw, 720px"
                  className="object-cover"
                  priority={i === 0}
                />
              </div>
              <h2 className="mt-6 text-2xl font-medium leading-[1.2] text-text-default md:mt-10 md:px-3 md:text-[32px]">
                {t(`${post.key}.title`)}
              </h2>
              <p className="mt-3 pb-3 text-base leading-[1.24] text-text-default md:mt-4 md:px-3 md:text-lg md:leading-[1.4]">
                {t(`${post.key}.text`)}
              </p>
            </article>
          </Reveal>
        ))}
      </div>
    </SidebarLayout>
  );
}
