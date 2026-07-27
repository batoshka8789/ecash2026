'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { useRouter } from '@/i18n/navigation';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { Select } from '@/components/ui/Select';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useErrorText } from '@/lib/useErrorText';
import { currencyName, currencySymbol, formatDateTime, formatNumber } from '@/lib/format';
import type { RateAlert } from '@/lib/domain';

import { AmountBox } from './PairFields';

/**
 * «dropdown date»: 54 в высоту на мобильном (1774:158764) и 66 с 768
 * (1177:57578), радиус 20, заливка и обводка
 * одного цвета — surface/surf2. Отличается от обычного селекта (54, прозрачный
 * с видимой обводкой), поэтому задаётся точечно, а не в самом компоненте.
 */
const dateSelectBtn =
  'md:h-[66px]! border-surface-page-surf2! bg-surface-page-surf2! hover:border-stroke-surface3!' +
  // на 360 «Месяц» не влезает и при паддинге макета (16) — отдаём слову 3px
  ' max-md:px-3';

const DEFAULT_DEP = 1;

const parseRate = (v: string) => parseFloat(v.replace(/[\s ]/g, '').replace(',', '.'));

const intlLocale = (locale: string) =>
  locale === 'kk' ? 'kk-KZ' : locale === 'en' ? 'en-US' : 'ru-RU';

/**
 * «Уведомить об изменении курса»: подписка хранится в нашей БД
 * и срабатывает по событию rate.changed из SignalR Ecash.
 * Дата проверяется по-настоящему: 31 февраля и прошедшие даты не пройдут.
 */
export function SubscribeFlow() {
  const t = useTranslations('subscribe');
  const locale = useLocale();
  const router = useRouter();
  const { authed } = useAuth();
  const errorText = useErrorText();
  const qc = useQueryClient();

  const [foreign, setForeign] = useState('USD');
  const [rate, setRate] = useState('');
  const [day, setDay] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [year, setYear] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  /** созданная подписка → вместо формы показываем экран-подтверждение */
  const [created, setCreated] = useState<RateAlert | null>(null);
  /** Ecash-курс на момент оформления — снимок для экрана-подтверждения */
  const [snapshotRate, setSnapshotRate] = useState(0);
  const [removedOk, setRemovedOk] = useState(false);

  const ratesQ = useQuery({
    queryKey: ['rates', DEFAULT_DEP],
    queryFn: ({ signal }) => api.rates.forDep(DEFAULT_DEP, signal),
    staleTime: 60_000,
  });
  const stat = ratesQ.data?.rates.find((r) => r.currencyCode === foreign);
  const currentRate = stat?.sell ?? 0;

  const tr = useTranslations('rates');
  const currencyOptions = useMemo(
    () =>
      (ratesQ.data?.rates ?? [])
        .filter((r) => r.currencyCode !== 'KZT' && (r.buy > 0 || r.sell > 0))
        .map((r) => ({
          code: r.currencyCode,
          name: currencyName(r.currencyCode, locale, (g) => tr('gold', { grams: g })),
        })),
    [ratesQ.data, locale, tr],
  );

  // календарь: реальное число дней в выбранном месяце/году
  const now = new Date();
  const years = [now.getFullYear(), now.getFullYear() + 1].map(String);
  const monthNames = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(intlLocale(locale), { month: 'long' });
    return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(2026, i, 1)));
  }, [locale]);
  const daysInMonth =
    month !== null && year !== null
      ? new Date(Number(year), Number(month) + 1, 0).getDate()
      : 31;
  const days = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));

  const create = useMutation({
    mutationFn: (until: string) =>
      api.rateAlerts.create({
        currencyFrom: 'KZT',
        currencyTo: foreign,
        targetRate: parseRate(rate),
        until,
      }),
    onSuccess: (res) => {
      setSnapshotRate(currentRate);
      setCreated(res.alert);
      setFormError(null);
      setShowErrors(false);
      setRemovedOk(false);
      void qc.invalidateQueries({ queryKey: ['rate-alerts'] });
    },
    onError: (e) => {
      setFormError(e instanceof ApiError ? errorText(e.message) : errorText('errors.unknown'));
      setShowErrors(true);
    },
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => api.rateAlerts.remove(id),
    onSuccess: () => {
      setCreated(null);
      setRemovedOk(true);
      void qc.invalidateQueries({ queryKey: ['rate-alerts'] });
    },
  });

  // валидность целевого курса — по числовому разбору, не по truthiness строки
  const parsedRate = parseRate(rate);
  const rateValid = Number.isFinite(parsedRate) && parsedRate > 0;
  const dateMissing = day === null || month === null || year === null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!authed) {
      router.push('/login');
      return;
    }
    if (!rateValid || dateMissing) {
      setFormError(null);
      setShowErrors(true);
      return;
    }
    const until = new Date(Number(year), Number(month), Number(day), 23, 59, 59);
    // JS «переворачивает» несуществующие даты (31 февраля → 3 марта) — ловим это
    if (until.getMonth() !== Number(month) || until.getDate() !== Number(day)) {
      setFormError(errorText('errors.dateRequired'));
      setShowErrors(true);
      return;
    }
    if (until.getTime() <= Date.now()) {
      setFormError(errorText('errors.dateInPast'));
      setShowErrors(true);
      return;
    }
    create.mutate(until.toISOString());
  };

  // -------------------------------------------- экран-подтверждение (1004:39525)
  if (created) {
    const untilDate = new Date(created.until).toLocaleDateString(intlLocale(locale), {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const removeError =
      removeMut.error instanceof ApiError
        ? errorText(removeMut.error.message)
        : removeMut.error
          ? errorText('errors.unknown')
          : null;

    return (
      <div className="container-page flex flex-col gap-5 pt-8">
        <div role="status" aria-live="polite" className="flex flex-col items-center text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-hardsoft">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-text-always-white">
              <Icon name="verified_user" size={26} filled />
            </span>
          </span>
          <h1 className="mt-5 text-lg font-medium leading-[1.2] text-text-default md:text-[32px]">
            {t('successTitle')}
          </h1>
          <p className="mt-2 text-sm text-text-disabled">
            {t('sentAtLabel')}: {formatDateTime(created.createdAt, locale)}
          </p>
        </div>

        <section className="rounded-[22px] border border-stroke-surface1 bg-surface-page-surf1 p-4 md:rounded-[28px] md:p-8">
          <h2 className="text-lg font-medium leading-[1.2] text-text-default md:text-[32px]">
            {t('pairTitle')}
          </h2>

          <div className="relative mt-6 flex flex-col items-stretch gap-2 md:mt-10 md:flex-row md:items-center md:gap-3">
            <AmountBox
              label={t('targetLabel')}
              value={formatNumber(created.targetRate, locale)}
              readOnly
              currency="KZT"
            />
            <span className="absolute left-1/2 top-1/2 z-10 flex h-9 w-9 shrink-0 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[20px] border border-stroke-modal bg-surface-page-surf2 text-text-default shadow-[0_1px_4px_rgba(12,12,13,0.1)] md:static md:mx-auto md:h-5 md:w-5 md:translate-x-0 md:translate-y-0 md:rounded-none md:border-0 md:bg-transparent md:shadow-none">
              <Icon name="notifications_active" size={20} />
            </span>
            <AmountBox
              label={t('perOneLabel')}
              value="1"
              readOnly
              currency={created.currencyTo}
            />
          </div>

          {snapshotRate > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-text-default">
              {t('ecashRateAtCreation')}
              <span className="rounded-xl bg-surface-page-surf2 px-3 py-1 text-text-disabled">
                {formatNumber(snapshotRate, locale)} ₸ = 1 {currencySymbol(created.currencyTo)}
              </span>
            </div>
          )}

          <p className="mt-4 text-sm text-text-disabled">
            {t('notifyUntil')}: <span className="text-text-default">{untilDate}</span>
          </p>
        </section>

        {removeError && (
          <p role="alert" className="text-center text-sm text-text-negative">
            {removeError}
          </p>
        )}

        <div className="flex flex-col items-stretch gap-3 pb-6 sm:flex-row sm:justify-center">
          <Button
            variant="brand-outline"
            onClick={() => removeMut.mutate(created.id)}
            disabled={removeMut.isPending}
            className="sm:min-w-52"
          >
            {t('disable')}
          </Button>
          <Button
            onClick={() => router.push('/')}
            disabled={removeMut.isPending}
            className="sm:min-w-52"
          >
            {t('toHome')}
          </Button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------- форма
  return (
    <form onSubmit={submit} className="container-page bleed-mobile flex flex-col gap-1 pt-8" noValidate>
      <Toast
        open={showErrors}
        tone="negative"
        onClose={() => setShowErrors(false)}
        closeLabel={t('close')}
      >
        {formError ?? t('fillRequired')}
      </Toast>
      <Toast
        open={removedOk}
        tone="positive"
        onClose={() => setRemovedOk(false)}
        closeLabel={t('close')}
      >
        {t('disabledToast')}
      </Toast>

      <section className="rounded-[22px] border border-stroke-surface1 bg-surface-page-surf1 p-4 md:rounded-[28px] md:p-8">
        <h1 className="text-lg font-medium leading-[1.2] text-text-default md:text-[32px]">
          {t('pairTitle')}
        </h1>

        <div className="relative mt-6 flex flex-col items-stretch gap-2 md:mt-10 md:flex-row md:items-center md:gap-3">
          <AmountBox
            label={t('targetLabel')}
            value={rate}
            onChange={(v) => setRate(v.replace(/[^\d\s.,]/g, '').slice(0, 10))}
            currency="KZT"
            invalid={showErrors && !rateValid}
          />
          {/* мобильный фрейм 1774:158752 — 36×36 r20 на surf2, с 768px голая иконка */}
          <span className="absolute left-1/2 top-1/2 z-10 flex h-9 w-9 shrink-0 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[20px] border border-stroke-modal bg-surface-page-surf2 text-text-default shadow-[0_1px_4px_rgba(12,12,13,0.1)] md:static md:mx-auto md:h-5 md:w-5 md:translate-x-0 md:translate-y-0 md:rounded-none md:border-0 md:bg-transparent md:shadow-none">
            <Icon name="notifications_active" size={20} />
          </span>
          <AmountBox
            label={t('perOneLabel')}
            value="1"
            readOnly
            currency={foreign}
            currencyOptions={currencyOptions}
            onCurrencyChange={setForeign}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-text-default">
          {t('currentRate')}
          {ratesQ.isPending ? (
            <span className="h-[23px] w-32 animate-pulse rounded-xl bg-surface-page-surf2" />
          ) : currentRate > 0 ? (
            <span className="rounded-xl bg-surface-page-surf2 px-3 py-1 text-text-disabled">
              {formatNumber(currentRate, locale)} ₸ = 1 {currencySymbol(foreign)}
            </span>
          ) : (
            <span className="text-text-disabled">{errorText('errors.RATES_NOT_FOUND')}</span>
          )}
        </div>
      </section>

      <section className="rounded-[22px] border border-stroke-surface1 bg-surface-page-surf1 p-4 md:rounded-[28px] md:p-8">
        <h2 className="text-lg font-medium leading-[1.2] text-text-default md:text-[32px]">
          {t('untilTitle')}
        </h2>
        {/* 1177:57578 — три селекта 132×66 в ряд с зазором 4, группа 404px.
            Подписи селектов скрыты визуально: в макете над группой одна общая
            подпись (её роль играет заголовок выше), а внутри — плейсхолдеры. */}
        <div className="mt-6 grid grid-cols-3 gap-1 md:mt-10 md:max-w-[404px] [&_[id$='-label']]:sr-only">
          {/* Select менять нельзя — рамку ошибки даёт контейнер вокруг него */}
          <div
            className={clsx(
              'rounded-[20px] border',
              showErrors && day === null ? 'border-negative' : 'border-transparent',
            )}
          >
            <Select
              buttonClassName={dateSelectBtn}
              label={t('day')}
              value={day}
              onChange={setDay}
              placeholder={t('day')}
              options={days.map((d) => ({ value: d, label: d }))}
            />
          </div>
          <div
            className={clsx(
              'rounded-[20px] border',
              showErrors && month === null ? 'border-negative' : 'border-transparent',
            )}
          >
            <Select
              buttonClassName={dateSelectBtn}
              label={t('month')}
              value={month}
              onChange={(v) => {
                setMonth(v);
                // при смене месяца день может выйти за диапазон
                if (
                  day !== null &&
                  Number(day) > new Date(Number(year ?? '2026'), Number(v) + 1, 0).getDate()
                ) {
                  setDay(null);
                }
              }}
              placeholder={t('month')}
              options={monthNames.map((name, i) => ({ value: String(i), label: name }))}
            />
          </div>
          <div
            className={clsx(
              'rounded-[20px] border',
              showErrors && year === null ? 'border-negative' : 'border-transparent',
            )}
          >
            <Select
              buttonClassName={dateSelectBtn}
              label={t('year')}
              value={year}
              onChange={setYear}
              placeholder={t('year')}
              options={years.map((y) => ({ value: y, label: y }))}
            />
          </div>
        </div>

        {showErrors && dateMissing && (
          <p role="alert" className="mt-3 text-sm text-text-negative">
            {t('dateError')}
          </p>
        )}

        {!authed && (
          <p className="mt-4 text-sm text-text-disabled" role="note">
            {t('loginToSubscribe')}
          </p>
        )}

        <Button type="submit" className="mt-6 w-full md:mt-10 md:w-auto" disabled={create.isPending}>
          {t('cta')}
        </Button>
      </section>
    </form>
  );
}
