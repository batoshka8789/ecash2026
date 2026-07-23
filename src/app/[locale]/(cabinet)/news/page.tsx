'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { SidebarLayout } from '@/components/profile/SidebarLayout';
import { Reveal } from '@/components/ui/Reveal';
import { api } from '@/lib/api';
import { useQuery } from '@/lib/useApi';

/** Новости — список берётся из мок-бэкенда, тексты из переводов. */
export default function NewsPage() {
  const t = useTranslations('news');
  const { data, loading } = useQuery(useCallback(() => api.news(), []));

  return (
    <SidebarLayout>
      <div className="flex flex-col gap-6">
        {loading && <p className="py-10 text-center text-sm text-text-disabled">{t('loading')}</p>}

        {data?.posts.map((post, i) => (
          <Reveal key={post.id} delay={i * 0.06}>
            <article className="rounded-2xl bg-surface-page-surf1 p-4 sm:rounded-3xl sm:p-6">
              <img src={post.image} alt="" className="h-56 w-full rounded-2xl object-cover sm:h-72" />
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
