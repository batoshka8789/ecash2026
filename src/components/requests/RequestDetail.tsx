'use client';

import { use } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Link } from '@/i18n/navigation';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/lib/api';
import { useCountdown } from '@/lib/hooks';
import { useErrorText } from '@/lib/useErrorText';
import { currencySymbol, formatDateTime, formatNumber } from '@/lib/format';
import { AmountBox } from '@/components/flows/PairFields';
import { useAuth } from '@/lib/auth';
import type { ExchangeRequest } from '@/lib/domain';

/**
 * Карточка заявки — экраны состояний из макета:
 * статус 0 «на рассмотрении» (1004:46391), бронь с таймером (1004:37169),
 * предложение индивидуального курса, отмена «Снято с брони», проведена.
 * Пока заявка активна — поллинг; SSE-события инвалидируют кэш мгновенно.
 */
export function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const requestId = Number(id);
  const t = useTranslations('requests');
  const tf = useTranslations('flows');
  const locale = useLocale();
  const errorText = useErrorText();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['requests', 'detail', requestId],
    queryFn: ({ signal }) => api.requests.get(requestId, signal),
    enabled: Number.isInteger(requestId) && requestId > 0,
    refetchInterval: (query) => {
      const r = query.state.data?.request;
      if (!r) return false;
      // ждём ответа казначея — опрашиваем чаще; бронь — раз в 15 с
      if (r.phase === 'pending') return 5_000;
      if (r.phase === 'held') return 15_000;
      return false;
    },
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['requests'] });
    void qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  const cancelMut = useMutation({
    mutationFn: () => api.requests.cancel(requestId),
    onSuccess: invalidate,
  });
  const confirmMut = useMutation({
    mutationFn: () => api.requests.confirmIndividual(requestId),
    onSuccess: invalidate,
  });
  const rejectMut = useMutation({
    mutationFn: () => api.requests.rejectIndividual(requestId),
    onSuccess: invalidate,
  });

  const r = q.data?.request;

  if (q.isPending) {
    return (
      <div className="container-page pt-10" aria-busy>
        <div className="mx-auto h-64 max-w-2xl animate-pulse rounded-[28px] bg-surface-page-surf1" />
      </div>
    );
  }

  if (q.isError || !r) {
    const message =
      q.error instanceof ApiError ? errorText(q.error.message) : errorText('errors.notFound');
    return (
      <div className="container-page flex flex-col items-center gap-4 pt-16 text-center">
        <p className="text-text-disabled">{message}</p>
        <Link href="/requests" className="text-text-brand hover:opacity-80">
          {t('toList')}
        </Link>
      </div>
    );
  }

  const mutError = [cancelMut, confirmMut, rejectMut]
    .map((m) => (m.error instanceof ApiError ? errorText(m.error.message) : null))
    .find(Boolean);

  const cancellable = r.phase === 'pending' || r.phase === 'held';
  const foreign = r.currencyFrom === 'KZT' ? r.currencyTo : r.currencyFrom;

  return (
    <div className="container-page flex flex-col gap-1 pt-10">
      <StatusHead request={r} />

      {r.needsClientConfirmation && (
        <section className="mb-6 rounded-[28px] border border-stroke-surface1 bg-surface-page-surf1 p-4 text-center md:p-8">
          <h2 className="text-2xl font-medium leading-[1.2] text-text-default sm:text-[32px]">
            {t('offerTitle')}
          </h2>
          <p className="mt-2 text-base font-medium leading-5 text-text-disabled">
            {t('offerText', { min: r.reserveMinutes })}
          </p>
          <p className="mt-4 text-2xl font-bold text-text-brand">
            {formatNumber(r.rate, locale)} ₸ = 1 {currencySymbol(foreign)}
          </p>
          {r.reservedUntil && <OfferCountdown until={r.reservedUntil} />}
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Button
              onClick={() => confirmMut.mutate()}
              disabled={confirmMut.isPending || rejectMut.isPending}
              className="rounded-[20px] sm:min-w-44"
            >
              {t('accept')}
            </Button>
            <Button
              variant="surf2"
              onClick={() => rejectMut.mutate()}
              disabled={confirmMut.isPending || rejectMut.isPending}
              className="rounded-[20px] sm:min-w-44"
            >
              {t('decline')}
            </Button>
          </div>
        </section>
      )}

      <div className="mb-6">
        <h2 className="text-2xl font-medium leading-[1.2] text-text-default sm:text-[32px]">
          {t('details')}
        </h2>
        <p className="mt-2 text-base font-medium leading-5 text-text-disabled">
          {t('sentAt')}: {formatDateTime(r.createdAt, locale)} · {t('number', { id: r.requestId })}
        </p>
      </div>

      <section className="rounded-[28px] border border-stroke-surface1 bg-surface-page-surf1 p-4 md:p-8">
        <h3 className="text-2xl font-medium leading-[1.2] text-text-default sm:text-[32px]">
          {t('pair')}
        </h3>
        <div className="mt-4 flex flex-col gap-3 lg:flex-row">
          <AmountBox
            label={`${tf('pair.give')} (${currencySymbol(r.currencyFrom)})`}
            value={
              r.currencyFrom === 'KZT'
                ? formatNumber(r.amount, locale)
                : formatNumber(r.value, locale)
            }
            readOnly
            currency={r.currencyFrom}
          />
          <AmountBox
            label={`${tf('pair.get')} (${currencySymbol(r.currencyTo)})`}
            value={
              r.status === 0 && r.isIndividual && !r.needsClientConfirmation
                ? tf('pair.underReview')
                : r.currencyTo === 'KZT'
                  ? formatNumber(r.amount, locale)
                  : formatNumber(r.value, locale)
            }
            readOnly
            currency={r.currencyTo}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-text-disabled">
          {t('rate')}:
          <span className="rounded-[20px] bg-surface-page-surf2 px-3 py-1.5 text-text-default">
            {formatNumber(r.rate, locale)} ₸ = 1 {currencySymbol(foreign)}
          </span>
        </div>
        {/* комментарий клиента — сюда попадает выбранный тип купюр */}
        {r.comment && (
          <p className="mt-4 text-sm text-text-disabled">
            {t('commentLabel')}: <span className="text-text-default">{r.comment}</span>
          </p>
        )}
        {r.acceptComment && r.phase === 'cancelled' && (
          <p className="mt-4 text-sm text-text-disabled">
            {t('reason')}: <span className="text-text-default">{r.acceptComment}</span>
          </p>
        )}
        {r.printedTicket && (
          <p className="mt-4 text-sm text-text-disabled">
            {t('ticket')}: <span className="font-mono text-text-default">{r.printedTicket}</span>
          </p>
        )}
      </section>

      {r.depId != null && <BranchBlock depId={r.depId} />}

      <YourDataBlock />

      {r.history.length > 0 && (
        <section className="rounded-[28px] border border-stroke-surface1 bg-surface-page-surf1 p-4 md:p-8">
          <h3 className="text-2xl font-medium leading-[1.2] text-text-default sm:text-[32px]">
            {t('history')}
          </h3>
          <ol className="mt-4 flex flex-col gap-3">
            {r.history.map((h, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <Icon name="schedule" size={18} className="mt-0.5 shrink-0 text-text-disabled" />
                <span>
                  <span className="text-text-default">
                    {h.oldStatusName} → {h.statusName}
                  </span>
                  <span className="ml-2 text-text-disabled">
                    {formatDateTime(h.updatedAt, locale)}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {mutError && (
        <p role="alert" className="text-center text-sm text-text-negative">
          {mutError}
        </p>
      )}

      <div className="mt-6 flex flex-col items-center gap-3 pb-6 sm:flex-row sm:justify-between">
        <Link
          href="/requests"
          className="inline-flex items-center gap-1 text-sm text-text-disabled transition-colors hover:text-text-default"
        >
          <Icon name="arrow_back" size={18} />
          {t('toList')}
        </Link>
        {cancellable && !r.needsClientConfirmation && (
          <Button
            variant="surf2"
            className="rounded-[20px]"
            onClick={() => cancelMut.mutate()}
            disabled={cancelMut.isPending}
          >
            {t('cancel')}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Блок «Адрес отделения» — фрейм 1004:37169: адрес, часы, «На карте». */
function BranchBlock({ depId }: { depId: number }) {
  const t = useTranslations('requests');

  const q = useQuery({
    queryKey: ['departmentsInfo', 'single', depId],
    queryFn: ({ signal }) => api.departments.info(depId, signal).then((r) => r.department),
    staleTime: 5 * 60_000,
  });

  const dep = q.data;
  if (!dep) return null;

  return (
    <section className="rounded-[28px] border border-stroke-surface1 bg-surface-page-surf1 p-4 md:p-8">
      <h3 className="text-2xl font-medium leading-[1.2] text-text-default sm:text-[32px]">
        {t('branch')}
      </h3>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-start gap-2 text-sm text-text-default sm:text-base">
            <Icon name="account_balance" size={18} className="mt-0.5 shrink-0 text-text-disabled" />
            <span className="min-w-0">{dep.address}</span>
          </div>
          {dep.timetable && (
            <div className="mt-1 text-sm text-text-disabled">
              {dep.timetable.openTime} - {dep.timetable.closeTime}
            </div>
          )}
        </div>
        <Link
          href={`/locations?view=map&depId=${depId}`}
          className="inline-flex h-[38px] items-center gap-1.5 rounded-[20px] bg-surface-page-surf2 px-4 text-sm font-medium leading-5 text-text-default transition-colors hover:bg-comp-surface2-hover"
        >
          <Icon name="location_on" size={16} filled />
          {t('onMapBtn')}
        </Link>
      </div>
    </section>
  );
}

/** Блок «Ваши данные» — телефон и имя аккаунта, как в макете заявки. */
function YourDataBlock() {
  const t = useTranslations('requests');
  const { account } = useAuth();
  if (!account) return null;

  const name = [account.firstName, account.lastName].filter(Boolean).join(' ');

  return (
    <section className="rounded-[28px] border border-stroke-surface1 bg-surface-page-surf1 p-4 md:p-8">
      <h3 className="text-2xl font-medium leading-[1.2] text-text-default sm:text-[32px]">
        {t('yourData')}
      </h3>
      <div className="mt-4 flex flex-col gap-3 text-sm text-text-default sm:text-base">
        {account.phoneNumber && (
          <div className="flex items-center gap-2">
            <Icon name="call" size={18} className="text-text-disabled" />
            {account.phoneNumber}
          </div>
        )}
        {name && (
          <div className="flex items-center gap-2">
            <Icon name="person" size={18} className="text-text-disabled" />
            {name}
          </div>
        )}
      </div>
    </section>
  );
}

/** Шапка состояния: щит + бейджи + заголовок + таймер брони. */
/** «7 704 *** ** 84» — как в макете: видны код оператора и две последние цифры. */
function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length < 6) return phone;
  return `${d.slice(0, 1)} ${d.slice(1, 4)} *** ** ${d.slice(-2)}`;
}

function StatusHead({ request: r }: { request: ExchangeRequest }) {
  const t = useTranslations('requests');
  const tn = useTranslations('notifications');
  const { account } = useAuth();

  const title = r.needsClientConfirmation
    ? tn('titles.offerReviewed')
    : r.phase === 'held'
      ? tn('titles.bookedPair')
      : r.phase === 'pending'
        ? r.isIndividual
          ? tn('titles.offerSent')
          : t('status0')
        : r.phase === 'done'
          ? t('status1')
          : t('cancelled');

  const iconName =
    r.phase === 'held' || r.phase === 'done'
      ? 'verified_user'
      : r.phase === 'pending'
        ? 'hourglass_top'
        : 'cancel';

  return (
    <div className="mb-14 flex flex-col items-center text-center">
      <span
        className={clsx(
          'flex h-30 w-30 items-center justify-center rounded-full',
          r.phase === 'cancelled' ? 'bg-surface-page-surf2' : 'bg-brand-hardsoft',
        )}
      >
        <span
          className={clsx(
            'flex h-20 w-20 items-center justify-center rounded-full',
            r.phase === 'cancelled' ? 'text-text-disabled' : 'text-brand/60',
          )}
        >
          <Icon name={iconName} size={80} filled />
        </span>
      </span>

      <div className="mt-13 flex flex-wrap items-center justify-center gap-2">
        {r.phase === 'held' && (
          <span className="rounded-xl bg-alert-hardsoft px-2 py-0.5 text-xs font-bold leading-[18px] text-text-additional">
            {tn('badges.booking30').replace('30', String(r.reserveMinutes))}
          </span>
        )}
        {r.isIndividual && (
          <span className="rounded-xl bg-alert-hardsoft px-2 py-0.5 text-xs font-bold leading-[18px] text-text-additional">
            {tn('badges.individual')}
          </span>
        )}
        {/* маскированный номер заявителя — бейдж из макета 1004:37169 */}
        {account?.phoneNumber && (
          <span className="rounded-xl bg-brand-hardsoft px-2 py-0.5 text-sm font-medium leading-[1.1] text-text-brand">
            {tn('badges.numberValue', { value: maskPhone(account.phoneNumber) })}
          </span>
        )}
      </div>

      <h1 className="mt-2 text-2xl font-medium leading-[1.2] text-text-default sm:text-[32px]">
        {title}
      </h1>

      {r.phase === 'pending' && !r.needsClientConfirmation && (
        <p
          className="mt-2 max-w-md text-base font-medium leading-5 text-text-disabled"
          aria-live="polite"
        >
          {t('awaiting')}
        </p>
      )}

      {r.phase === 'held' && r.reservedUntil && <HoldCountdown until={r.reservedUntil} />}
    </div>
  );
}

/** Таймер брони — от reservedUntil (60 мин с ответа казначея), по серверному времени. */
function HoldCountdown({ until }: { until: string }) {
  const t = useTranslations('requests');
  const tf = useTranslations('flows.done');
  const left = useCountdown(until);
  const mm = String(Math.floor(left / 60));
  const ss = String(left % 60).padStart(2, '0');

  if (left <= 0) {
    return (
      <p className="mt-3 text-sm text-text-negative" role="status">
        {t('expired')}
      </p>
    );
  }
  return (
    <div
      className="mt-10 flex items-center gap-1 rounded-[20px] bg-surface-page-surf2 p-1 text-2xl font-semibold leading-[1.2] tracking-[-0.02em] text-text-default"
      role="timer"
    >
      <span className="sr-only">{t('timeLeft')}</span>
      <span className="rounded-2xl px-6 py-3">
        {mm} {tf('min')}
      </span>
      :
      <span className="rounded-2xl px-6 py-3">
        {ss} {tf('sec')}
      </span>
    </div>
  );
}

function OfferCountdown({ until }: { until: string }) {
  const t = useTranslations('requests');
  const left = useCountdown(until);
  if (left <= 0)
    return (
      <p className="mt-2 text-sm text-text-negative" role="status">
        {t('expired')}
      </p>
    );
  const mm = String(Math.floor(left / 60));
  const ss = String(left % 60).padStart(2, '0');
  return (
    <p className="mt-2 text-sm text-text-disabled" role="timer">
      {t('timeLeft')}: {mm}:{ss}
    </p>
  );
}
