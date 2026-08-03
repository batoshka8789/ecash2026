'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Link } from '@/i18n/navigation';
import { SidebarLayout } from '@/components/profile/SidebarLayout';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import type { ExchangeRequest, RequestPhase } from '@/lib/domain';

const PAGE_SIZE = 10;

const phaseStyles: Record<RequestPhase, string> = {
  pending: 'bg-alert text-text-inverted',
  held: 'bg-positive text-text-always-white',
  done: 'bg-surface-page-surf2 text-text-default',
  cancelled: 'bg-surface-page-surf2 text-text-disabled',
};

const statusKey = (r: ExchangeRequest) =>
  (`status${r.status}` as 'status0' | 'status1' | 'status3' | 'status8');

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
    <SidebarLayout>
      <h1 className="text-xl font-bold text-text-default sm:text-[28px]">{t('title')}</h1>

      {q.isPending && (
        <div className="mt-5 flex flex-col gap-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-page-surf1" />
          ))}
        </div>
      )}

      {q.isError && (
        <div className="mt-5 rounded-2xl bg-surface-page-surf1 p-6 text-center">
          <p className="text-text-disabled">{t('loadError')}</p>
          <Button className="mt-4" onClick={() => q.refetch()}>
            {t('retry')}
          </Button>
        </div>
      )}

      {q.data && q.data.requests.length === 0 && (
        <p className="mt-5 rounded-2xl bg-surface-page-surf1 p-6 text-center text-text-disabled">
          {t('empty')}
        </p>
      )}

      {q.data && q.data.requests.length > 0 && (
        <ul className="mt-5 flex flex-col gap-3">
          {q.data.requests.map((r) => (
            <li key={r.requestId}>
              <Link
                href={`/requests/${r.requestId}`}
                className="flex items-center gap-4 rounded-2xl bg-surface-page-surf1 p-4 transition-colors hover:bg-comp-surface1-hover sm:p-5"
              >
                <span
                  className={clsx(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
                    r.phase === 'held' || r.phase === 'done'
                      ? 'bg-brand-hardsoft text-text-brand'
                      : 'bg-surface-page-surf2 text-text-disabled',
                  )}
                >
                  <Icon
                    name={r.isIndividual ? 'percent' : 'currency_exchange'}
                    size={22}
                    filled={r.phase === 'held'}
                  />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-text-default">
                      {r.currencyFrom} → {r.currencyTo}
                    </span>
                    <span
                      className={clsx(
                        'rounded-md px-2 py-0.5 text-[11px] font-medium',
                        phaseStyles[r.phase],
                      )}
                    >
                      {/* короткий статус вместо фразы «Казначей предложил курс»:
                          в списке нужен ярлык, а не предложение */}
                      {r.needsClientConfirmation ? t('needsDecision') : t(statusKey(r))}
                    </span>
                  </span>
                  <span className="mt-1 block truncate text-sm text-text-disabled">
                    {formatMoney(r.value, locale)} {r.currencyFrom} ·{' '}
                    {t('rate')}: {formatNumber(r.rate, locale)} ·{' '}
                    {formatDateTime(r.createdAt, locale)}
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
          className="mt-4 w-full sm:w-auto"
          onClick={() => setPages((p) => p + 1)}
          disabled={q.isFetching}
        >
          {t('loadMore')}
        </Button>
      )}
    </SidebarLayout>
  );
}
