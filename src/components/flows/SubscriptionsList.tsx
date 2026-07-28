'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useErrorText } from '@/lib/useErrorText';
import { currencySymbol, formatNumber } from '@/lib/format';

/**
 * «Мои подписки» на курс: список активных уведомлений с отключением.
 * Для гостя блок не рендерится вовсе; удаление — через confirm-состояние
 * кнопки (без window.confirm).
 *
 * Живёт в разделе заявок кабинета, а не на /subscribe: в макете на роуте
 * подписки ровно две карточки формы ни на одном из пяти брейкпоинтов.
 * Собственной колонки блок не задаёт — её даёт вызывающий раздел.
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
    q.error instanceof ApiError
      ? errorText(q.error.message)
      : q.error
        ? errorText('errors.unknown')
        : null;

  const dateFmt = new Intl.DateTimeFormat(
    locale === 'kk' ? 'kk-KZ' : locale === 'en' ? 'en-US' : 'ru-RU',
    { day: '2-digit', month: '2-digit', year: 'numeric' },
  );

  return (
    <section
      aria-live="polite"
      className="mt-6 rounded-[22px] border border-stroke-surface1 bg-surface-page-surf1 p-4 md:rounded-[28px] md:p-8"
    >
      <h2 className="text-lg font-medium leading-[1.2] text-text-default md:text-[32px]">
        {t('myAlerts')}
      </h2>

      {q.isPending ? (
        <div
          className="mt-6 h-16 animate-pulse rounded-[20px] bg-surface-page-surf2 md:mt-10"
          aria-busy
        />
      ) : listError ? (
        <p role="alert" className="mt-6 text-sm text-text-negative md:mt-10">
          {listError}
        </p>
      ) : alerts.length === 0 ? (
        <p className="mt-6 text-sm text-text-disabled md:mt-10">{t('noAlerts')}</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2 md:mt-10">
          {alerts.map((a) => {
            const armed = confirmId === a.id;
            return (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-surface-page-surf2 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="text-base font-semibold leading-5 text-text-default">
                    {formatNumber(a.targetRate, locale)} ₸ = 1 {currencySymbol(a.currencyTo)}
                  </div>
                  <div className="mt-1.5 text-xs font-medium leading-4 text-text-disabled">
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
  );
}
