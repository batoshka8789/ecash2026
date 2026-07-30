'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@/i18n/navigation';
import { Icon } from '@/components/ui/Icon';
import { CurrencyFlag } from '@/components/ui/CurrencyFlag';
import { PillTabs } from '@/components/ui/PillTabs';
import { api, ApiError, type NotificationDto } from '@/lib/api';
import { useCountdown } from '@/lib/hooks';
import { currencyFlagClass, formatDateTime } from '@/lib/format';
import { useErrorText } from '@/lib/useErrorText';

/** Страница уведомлений: табы Актуальное / История, проекция заявок и подписок. */
export function NotificationsCard() {
  const t = useTranslations('notifications');
  const tSystem = useTranslations('system');
  const errorText = useErrorText();
  const [tab, setTab] = useState<'actual' | 'history'>('actual');

  const query = useQuery({
    queryKey: ['notifications', tab],
    queryFn: ({ signal }) => api.notifications.list(tab, signal),
    // при смене таба держим прошлый список и приглушаем его, пока грузится новый
    placeholderData: keepPreviousData,
  });
  const { data } = query;
  const errorStatus = query.error instanceof ApiError ? query.error.status : undefined;

  return (
    <div className="rounded-2xl bg-surface-page-surf1 p-5 sm:rounded-3xl sm:p-8">
      <PillTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'actual', label: t('tabs.actual') },
          { value: 'history', label: t('tabs.history') },
        ]}
      />

      {query.isPending && (
        <div aria-hidden className="mt-2 flex flex-col gap-5 py-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex animate-pulse gap-4">
              <span className="h-10 w-10 shrink-0 rounded-xl bg-surface-page-surf2" />
              <div className="flex flex-1 flex-col gap-2">
                <span className="h-4 w-2/5 rounded-full bg-surface-page-surf2" />
                <span className="h-4 w-3/5 rounded-full bg-surface-page-surf2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!query.isPending && query.isError && !data && (
        <div className="flex flex-col items-center gap-3 py-10">
          {errorStatus === 401 ? (
            <p className="text-sm text-text-negative">{t('needLogin')}</p>
          ) : (
            <>
              <p className="text-sm text-text-negative">{errorText(query.error.message)}</p>
              <button
                type="button"
                onClick={() => query.refetch()}
                className="cursor-pointer rounded-full border border-stroke-brand px-4 py-2 text-sm font-medium text-text-brand transition-colors hover:bg-brand-hardsoft"
              >
                {tSystem('retry')}
              </button>
            </>
          )}
        </div>
      )}

      {data && data.notifications.length === 0 && (
        <p className="py-10 text-center text-sm text-text-disabled">{t('empty')}</p>
      )}

      {data && data.notifications.length > 0 && (
        <div
          className={clsx(
            'mt-2 divide-y divide-divider-additional transition-opacity',
            query.isFetching && 'opacity-60',
          )}
        >
          {data.notifications.map((n) => (
            <NotificationRow key={n.id} n={n} />
          ))}
        </div>
      )}
    </div>
  );
}

const badgeStyles: Record<string, string> = {
  booking30: 'bg-alert text-text-inverted',
  rateAlert: 'bg-alert text-text-inverted',
  individual: 'bg-alert text-text-inverted',
};

/** Бейджи с известным переводом; чужой бейдж показываем как есть. */
const knownBadges = new Set(['booking30', 'rateAlert', 'individual']);

const actionCls = (variant: 'solid' | 'outline') =>
  clsx(
    'cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:cursor-default disabled:opacity-60',
    variant === 'solid'
      ? 'bg-btn-brand text-text-always-white hover:brightness-110'
      : 'border border-stroke-brand text-text-brand hover:bg-brand-hardsoft',
  );

function NotificationRow({ n }: { n: NotificationDto }) {
  const t = useTranslations('notifications');
  const tRequests = useTranslations('requests');
  const locale = useLocale();
  const qc = useQueryClient();
  const errorText = useErrorText();

  const act = useMutation({
    mutationFn: ({
      kind,
      id,
    }: {
      kind: 'accept' | 'decline' | 'cancel' | 'disable';
      id: number | string;
    }): Promise<unknown> => {
      if (kind === 'accept') return api.requests.confirmIndividual(id as number);
      if (kind === 'decline') return api.requests.rejectIndividual(id as number);
      if (kind === 'disable') return api.rateAlerts.remove(id as string);
      return api.requests.cancel(id as number);
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['notifications'] }),
        qc.invalidateQueries({ queryKey: ['requests'] }),
        qc.invalidateQueries({ queryKey: ['rate-alerts'] }),
      ]);
    },
  });

  const requestId = n.requestId;
  const canConfirm =
    requestId !== null && n.needsClientConfirmation && n.actions.includes('individual');
  const canCancel = requestId !== null && n.phase === 'held';
  const canResume = n.actions.includes('resume');
  const canDisable = n.alertId !== null && n.actions.includes('disable');

  return (
    <div className="py-5 first:pt-6">
      <div className="flex gap-4">
        <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-surface-modal-surf1">
          {/* !-префикс: у flag-icons свой .fi{width:1.333333em} перебивает w-7 той же специфичности */}
          <CurrencyFlag
            flag={currencyFlagClass(n.currencyFrom) ?? 'gold'}
            className="absolute left-0 top-0 h-5 !w-7 rounded-none"
          />
          <CurrencyFlag
            flag={currencyFlagClass(n.currencyTo) ?? 'gold'}
            className="absolute bottom-0 right-0 h-5 !w-7 rounded-none"
          />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {n.badges.map((b) => (
              <span
                key={b}
                className={clsx(
                  'rounded-md px-2 py-0.5 text-[11px] font-medium',
                  badgeStyles[b] ?? 'bg-surface-page-surf2 text-text-default',
                )}
              >
                {knownBadges.has(b) ? t(`badges.${b}`) : b}
              </span>
            ))}
            <span className="ml-auto text-xs text-text-disabled">
              {formatDateTime(n.createdAt, locale)}
            </span>
          </div>

          <div className="mt-1.5 text-base font-bold text-text-default">
            {t(`titles.${n.titleKey}`)}
          </div>

          {n.phase === 'held' && n.reservedUntil && <HoldCountdown until={n.reservedUntil} />}
          {n.phase === 'cancelled' && (
            <span className="mt-2 inline-block rounded-lg bg-surface-page-surf2 px-2.5 py-1 text-sm text-text-disabled">
              {t('cancelled')}
            </span>
          )}

          <div className="mt-3 flex flex-col gap-1.5 text-sm">
            <span
              className={clsx(
                'flex items-center gap-2',
                n.side === 'buy' ? 'text-text-positive' : 'text-text-negative',
              )}
            >
              <Icon
                name={n.side === 'buy' ? 'check_box' : 'indeterminate_check_box'}
                size={16}
                filled
              />
              {t(n.side === 'buy' ? 'buy' : 'sell')}
            </span>
            <span className="flex items-center gap-2 text-text-disabled">
              <Icon name="paid" size={16} />
              {n.amount}
            </span>
          </div>

          {(canConfirm || canCancel || canResume || canDisable) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {requestId !== null && (
                <>
                  {canConfirm && (
                    <>
                      <button
                        type="button"
                        disabled={act.isPending}
                        onClick={() => act.mutate({ kind: 'accept', id: requestId })}
                        className={actionCls('solid')}
                      >
                        {tRequests('accept')}
                      </button>
                      <button
                        type="button"
                        disabled={act.isPending}
                        onClick={() => act.mutate({ kind: 'decline', id: requestId })}
                        className={actionCls('outline')}
                      >
                        {tRequests('decline')}
                      </button>
                    </>
                  )}
                  {canCancel && (
                    <button
                      type="button"
                      disabled={act.isPending}
                      onClick={() => act.mutate({ kind: 'cancel', id: requestId })}
                      className={actionCls('outline')}
                    >
                      {tRequests('cancel')}
                    </button>
                  )}
                </>
              )}
              {canResume && (
                <Link href="/subscribe" className={actionCls('outline')}>
                  {t('actions.resume')}
                </Link>
              )}
              {canDisable && (
                <button
                  type="button"
                  disabled={act.isPending}
                  onClick={() => act.mutate({ kind: 'disable', id: n.alertId! })}
                  className={actionCls('outline')}
                >
                  {t('actions.disable')}
                </button>
              )}
            </div>
          )}

          <div aria-live="polite">
            {act.error && (
              <p className="mt-2 text-sm text-text-negative">{errorText(act.error.message)}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Живой таймер брони — отдельный компонент, чтобы секундный тик не перерисовывал список. */
function HoldCountdown({ until }: { until: string }) {
  const t = useTranslations('notifications');
  const left = useCountdown(until);
  const mm = String(Math.floor(left / 60));
  const ss = String(left % 60).padStart(2, '0');

  return (
    <div className="mt-2 flex items-center gap-1 text-sm text-text-default">
      <span className="rounded-lg bg-surface-page-surf2 px-2.5 py-1">
        {mm} {t('min')}
      </span>
      :
      <span className="rounded-lg bg-surface-page-surf2 px-2.5 py-1">
        {ss} {t('sec')}
      </span>
    </div>
  );
}
