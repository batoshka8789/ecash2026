'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { Icon } from '@/components/ui/Icon';
import { CurrencyFlag } from '@/components/ui/CurrencyFlag';
import { PillTabs } from '@/components/ui/PillTabs';
import { api } from '@/lib/api';
import { useQuery } from '@/lib/useApi';
import type { Booking, Notification } from '@/lib/types';

/** Страница уведомлений: табы Актуальное / История, данные из мок-бэкенда. */
export function NotificationsCard() {
  const t = useTranslations('notifications');
  const [tab, setTab] = useState<'actual' | 'history'>('actual');

  const load = useCallback(() => api.notifications.list(tab), [tab]);
  const { data, loading, error } = useQuery(load);

  useEffect(() => {
    if (data) void api.notifications.markAllRead().catch(() => {});
  }, [data]);

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

      {loading && <p className="py-10 text-center text-sm text-text-disabled">{t('loading')}</p>}
      {error && <p className="py-10 text-center text-sm text-text-negative">{t('needLogin')}</p>}

      {data && data.notifications.length === 0 && (
        <p className="py-10 text-center text-sm text-text-disabled">{t('empty')}</p>
      )}

      <div className="mt-2 divide-y divide-divider-additional">
        {data?.notifications.map((n) => (
          <NotificationRow
            key={n.id}
            n={n}
            booking={data.bookings.find((b) => b.id === n.bookingId)}
          />
        ))}
      </div>
    </div>
  );
}

const badgeStyles: Record<string, string> = {
  booking30: 'bg-alert text-text-inverted',
  number: 'bg-brand text-text-always-white',
  rateAlert: 'bg-alert text-text-inverted',
  individual: 'bg-alert text-text-inverted',
};

function NotificationRow({ n, booking }: { n: Notification; booking?: Booking }) {
  const t = useTranslations('notifications');
  const [left, setLeft] = useState(0);

  // живой таймер брони: считаем от expiresAt, чтобы он был честным
  useEffect(() => {
    if (!booking?.expiresAt || booking.status !== 'active') return;
    const tick = () => setLeft(Math.max(0, Math.floor((booking.expiresAt! - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [booking]);

  const cancelled = booking?.status === 'cancelled';
  const mm = String(Math.floor(left / 60));
  const ss = String(left % 60).padStart(2, '0');
  const date = new Date(n.createdAt).toLocaleDateString('ru-RU');

  return (
    <div className="py-5 first:pt-6">
      <div className="flex gap-4">
        <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-surface-modal-surf1">
          <CurrencyFlag flag="kz" className="absolute left-0 top-0 h-5 w-7 rounded-none" />
          <CurrencyFlag flag="us" className="absolute bottom-0 right-0 h-5 w-7 rounded-none" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {n.badges.map((b) => (
              <span key={b} className={clsx('rounded-md px-2 py-0.5 text-[11px] font-medium', badgeStyles[b])}>
                {b === 'number' && booking
                  ? t('badges.numberValue', { value: booking.maskedNumber })
                  : t(`badges.${b}`)}
              </span>
            ))}
            <span className="ml-auto flex items-center gap-1.5 text-xs text-text-disabled">
              {date}
              {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}
            </span>
          </div>

          <div className="mt-1.5 text-base font-bold text-text-default">{t(`titles.${n.titleKey}`)}</div>

          {booking?.expiresAt && !cancelled && (
            <div className="mt-2 flex items-center gap-1 text-sm text-text-default">
              <span className="rounded-lg bg-surface-page-surf2 px-2.5 py-1">
                {mm} {t('min')}
              </span>
              :
              <span className="rounded-lg bg-surface-page-surf2 px-2.5 py-1">
                {ss} {t('sec')}
              </span>
            </div>
          )}
          {cancelled && (
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
              <Icon name={n.side === 'buy' ? 'check_box' : 'indeterminate_check_box'} size={16} filled />
              {t(n.side === 'buy' ? 'buy' : 'sell')}
            </span>
            <span className="flex items-center gap-2 text-text-disabled">
              <Icon name="paid" size={16} />
              {n.amount}
            </span>
            {n.address && (
              <span className="flex items-center gap-2 text-text-disabled">
                <Icon name="account_balance" size={16} />
                {n.address}
              </span>
            )}
          </div>

          {n.actions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {n.actions.includes('resume') && (
                <ActionButton variant="outline">{t('actions.resume')}</ActionButton>
              )}
              {n.actions.includes('individual') && (
                <ActionButton variant="solid">{t('actions.individual')}</ActionButton>
              )}
              {n.actions.includes('book') && (
                <ActionButton variant="outline">{t('actions.book')}</ActionButton>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  variant,
  children,
}: {
  variant: 'solid' | 'outline';
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={clsx(
        'cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors',
        variant === 'solid'
          ? 'bg-btn-brand text-text-always-white hover:brightness-110'
          : 'border border-stroke-brand text-text-brand hover:bg-brand-hardsoft',
      )}
    >
      {children}
    </button>
  );
}
