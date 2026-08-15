'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useErrorText } from '@/lib/useErrorText';
import { currencySymbol, formatNumber, intlLocale } from '@/lib/format';
import { alertCurrency } from '@/lib/rate-alert';

/**
 * «Мои подписки» на курс: список активных уведомлений с отключением.
 * Для гостя блок не рендерится вовсе; удаление — через confirm-состояние
 * кнопки (без window.confirm).
 */
export function SubscriptionsList() {
  const t = useTranslations('subscribe');
  const locale = useLocale();
  const { authed } = useAuth();
  const errorText = useErrorText();
  const qc = useQueryClient();
  /** id подписки, у которой кнопка удаления в состоянии подтверждения */
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['rate-alerts'],
    queryFn: ({ signal }) => api.rateAlerts.list(signal),
    enabled: authed,
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => api.rateAlerts.remove(id),
    onSuccess: () => {
      setConfirmId(null);
      void qc.invalidateQueries({ queryKey: ['rate-alerts'] });
    },
  });

  if (!authed) return null;

  const alerts = (q.data?.alerts ?? []).filter((a) => a.active);
  const removeError =
    removeMut.error instanceof ApiError
      ? errorText(removeMut.error.message)
      : removeMut.error
        ? errorText('errors.unknown')
        : null;
  const listError =
    q.error instanceof ApiError ? errorText(q.error.message) : q.error ? errorText('errors.unknown') : null;

  const dateFmt = new Intl.DateTimeFormat(intlLocale(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div className="container-page pb-6 pt-5">
      <section
        aria-live="polite"
        className="rounded-2xl bg-surface-page-surf1 p-5 sm:rounded-3xl sm:p-8"
      >
        <h2 className="text-lg font-bold text-text-default sm:text-2xl">{t('myAlerts')}</h2>

        {q.isPending ? (
          <div className="mt-4 h-16 animate-pulse rounded-2xl bg-surface-page-surf2" aria-busy />
        ) : listError ? (
          <p role="alert" className="mt-4 text-sm text-text-negative">
            {listError}
          </p>
        ) : alerts.length === 0 ? (
          <p className="mt-4 text-sm text-text-disabled">{t('noAlerts')}</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {alerts.map((a) => {
              const armed = confirmId === a.id;
              return (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-page-surf2 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="text-base font-medium text-text-default">
                      {/* Валюта пары — та, что НЕ тенге: направление подписки
                          закодировано порядком пары, и у «Продаю» (USD→KZT)
                          currencyTo это KZT — строка выходила «470 ₸ = 1 ₸».
                          alertCurrency() уже решает это и покрыт тестами. */}
                      {formatNumber(a.targetRate, locale)} ₸ = 1{' '}
                      {currencySymbol(alertCurrency(a.currencyFrom, a.currencyTo) ?? a.currencyTo)}
                    </div>
                    <div className="mt-0.5 text-sm text-text-disabled">
                      {t('untilDate', { date: dateFmt.format(new Date(a.until)) })}
                    </div>
                  </div>

                  {armed ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => removeMut.mutate(a.id)}
                        disabled={removeMut.isPending}
                        className="inline-flex h-10 cursor-pointer items-center rounded-full bg-negative px-4 text-sm font-medium text-text-always-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {t('confirmRemove')}
                      </button>
                      <Button
                        variant="surf2"
                        size="icon"
                        aria-label={t('cancelRemove')}
                        onClick={() => setConfirmId(null)}
                        disabled={removeMut.isPending}
                      >
                        <Icon name="close" size={20} />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="surf2"
                      size="icon"
                      aria-label={t('removeAlert')}
                      onClick={() => setConfirmId(a.id)}
                      disabled={removeMut.isPending}
                    >
                      <Icon name="delete" size={20} />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {removeError && (
          <p role="alert" className="mt-3 text-sm text-text-negative">
            {removeError}
          </p>
        )}
      </section>
    </div>
  );
}
