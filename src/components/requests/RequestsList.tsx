'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Link } from '@/i18n/navigation';
import { SidebarLayout } from '@/components/profile/SidebarLayout';
import { SubscriptionsList } from '@/components/flows/SubscriptionsList';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { formatDateTime, formatNumber } from '@/lib/format';
import type { ExchangeRequest, RequestPhase } from '@/lib/domain';

const PAGE_SIZE = 10;

const phaseStyles: Record<RequestPhase, string> = {
  pending: 'bg-alert-hardsoft text-text-additional',
  held: 'bg-positive text-text-always-white',
  done: 'bg-brand-hardsoft text-text-brand',
  cancelled: 'bg-surface-page-surf2 text-text-disabled',
};

const statusKey = (r: ExchangeRequest) =>
  `status${r.status}` as 'status0' | 'status1' | 'status3' | 'status8';

/** Список заявок аккаунта: статусы 0/8/1/3, пагинация «Показать ещё». */
export function RequestsList() {
  const t = useTranslations('requests');
  const locale = useLocale();
  const [pages, setPages] = useState(1);

  const q = useQuery({
    queryKey: ['requests', 'list', pages],
    queryFn: ({ signal }) => api.requests.list(1, pages * PAGE_SIZE, signal),
    // активные заявки обновляются: казначей может ответить в любой момент
    refetchInterval: (query) =>
      query.state.data?.requests.some((r) => r.phase === 'pending' || r.phase === 'held')
        ? 10_000
        : false,
  });

  return (
    /* Экрана списка заявок в макете нет: ниже xl колонка кабинета идёт в край
       экрана, поэтому боковые поля этому разделу задаём здесь. */
    <SidebarLayout>
      <div className="px-4 xl:px-0">
        <h1 className="text-2xl font-medium leading-[1.2] text-text-default sm:text-[32px]">
          {t('title')}
        </h1>

        {q.isPending && (
          <div className="mt-6 flex flex-col gap-1" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-[28px] bg-surface-page-surf1" />
            ))}
          </div>
        )}

        {q.isError && (
          <div className="mt-6 rounded-[28px] border border-stroke-surface1 bg-surface-page-surf1 p-8 text-center">
            <p className="text-text-disabled">{t('loadError')}</p>
            <Button className="mt-4" onClick={() => q.refetch()}>
              {t('retry')}
            </Button>
          </div>
        )}

        {q.data && q.data.requests.length === 0 && (
          <p className="mt-6 rounded-[28px] border border-stroke-surface1 bg-surface-page-surf1 p-8 text-center text-text-disabled">
            {t('empty')}
          </p>
        )}

        {q.data && q.data.requests.length > 0 && (
          <ul className="mt-6 flex flex-col gap-1">
            {q.data.requests.map((r) => (
              <li key={r.requestId}>
                <Link
                  href={`/requests/${r.requestId}`}
                  className="flex items-center gap-3 rounded-[28px] border border-stroke-surface1 bg-surface-page-surf1 p-4 transition-colors hover:bg-comp-surface1-hover md:px-8 md:py-7"
                >
                  <span
                    className={clsx(
                      'flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-2xl border border-surface-page-surf3',
                      r.phase === 'held' || r.phase === 'done'
                        ? 'text-text-brand'
                        : 'text-text-disabled',
                    )}
                  >
                    <Icon
                      name={r.isIndividual ? 'percent' : 'currency_exchange'}
                      size={24}
                      filled={r.phase === 'held'}
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1">
                      <span className="text-lg font-bold leading-6 text-text-default">
                        {r.currencyFrom} → {r.currencyTo}
                      </span>
                      <span
                        className={clsx(
                          'rounded-xl px-2 py-0.5 text-xs font-bold leading-[18px]',
                          phaseStyles[r.phase],
                        )}
                      >
                        {r.needsClientConfirmation ? t('offerTitle') : t(statusKey(r))}
                      </span>
                    </span>
                    <span className="mt-1.5 block truncate text-sm font-semibold text-text-disabled">
                      {formatNumber(r.value, locale)} {r.currencyFrom} · {t('rate')}:{' '}
                      {formatNumber(r.rate, locale)} · {formatDateTime(r.createdAt, locale)}
                    </span>
                  </span>

                  <Icon name="chevron_right" size={22} className="shrink-0 text-text-disabled" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {q.data && q.data.total > q.data.requests.length && (
          <Button
            variant="surf2"
            className="mt-4 w-full rounded-[20px] sm:w-auto"
            onClick={() => setPages((p) => p + 1)}
            disabled={q.isFetching}
          >
            {t('loadMore')}
          </Button>
        )}

        {/* «Мои подписки» на курс: на /subscribe макет держит только форму,
            поэтому управление подписками живёт здесь, рядом с заявками. */}
        <SubscriptionsList />
      </div>
    </SidebarLayout>
  );
}
