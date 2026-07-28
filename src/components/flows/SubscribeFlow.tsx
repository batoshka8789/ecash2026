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
import { AuthModal } from '@/components/auth/AuthModal';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useErrorText } from '@/lib/useErrorText';
import { currencyName, currencySymbol, formatDateTime, formatNumber, intlLocale } from '@/lib/format';
import type { RateAlert } from '@/lib/domain';
import { AmountBox } from './PairFields';

const DEFAULT_DEP = 1;

const parseRate = (v: string) => parseFloat(v.replace(/[\s ]/g, '').replace(',', '.'));

/** Радио «Покупаю/Продаю» — точь-в-точь макет (32×32 бейдж с чекмарком). */
function OperationRadio({
  label,
  checked,
  onSelect,
}: {
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className="flex items-center gap-3 text-left"
    >
      <span
        className={clsx(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
          checked ? 'bg-brand' : 'bg-surface-page-surf2',
        )}
      >
        {checked && <Icon name="check" size={16} className="text-text-always-white" />}
      </span>
      <span className="text-base font-medium text-text-default">{label}</span>
    </button>
  );
}

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
  /** true — жду выгодную ПОКУПКУ валюты (курс продажи обменника);
   *  false — жду выгодную ПРОДАЖУ (курс покупки обменника). */
  const [buying, setBuying] = useState(true);
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
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const ratesQ = useQuery({
    queryKey: ['rates', DEFAULT_DEP],
    queryFn: ({ signal }) => api.rates.forDep(DEFAULT_DEP, signal),
    staleTime: 60_000,
  });
  const stat = ratesQ.data?.rates.find((r) => r.currencyCode === foreign);
  const currentRate = (buying ? stat?.sell : stat?.buy) ?? 0;

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
        // направление кодируется порядком пары, как в бронировании:
        // KZT→валюта — жду курс ПРОДАЖИ обменника (я покупаю),
        // валюта→KZT — жду курс ПОКУПКИ (я продаю)
        currencyFrom: buying ? 'KZT' : foreign,
        currencyTo: buying ? foreign : 'KZT',
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

  /** здесь пользователь уже гарантированно авторизован */
  const tryCreate = () => {
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!authed) {
      setAuthModalOpen(true);
      return;
    }
    tryCreate();
  };

  // -------------------------------------------- экран-подтверждение (1004:39525)
  if (created) {
    const createdForeign =
      created.currencyTo === 'KZT' ? created.currencyFrom : created.currencyTo;
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
      <div className="container-page flex flex-col gap-5 pt-6">
        <div role="status" aria-live="polite" className="flex flex-col items-center text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-hardsoft">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-text-always-white">
              <Icon name="verified_user" size={26} filled />
            </span>
          </span>
          <h1 className="mt-5 text-lg font-bold text-text-default sm:text-2xl">
            {t('successTitle')}
          </h1>
          <p className="mt-2 text-sm text-text-disabled">
            {t('sentAtLabel')}: {formatDateTime(created.createdAt, locale)}
          </p>
        </div>

        <section className="rounded-2xl bg-surface-page-surf1 p-5 sm:rounded-3xl sm:p-8">
          <h2 className="text-lg font-bold text-text-default sm:text-2xl">{t('pairTitle')}</h2>

          <div className="mt-5 flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
            <AmountBox
              label={t('targetLabel')}
              value={formatNumber(created.targetRate, locale)}
              readOnly
              currency="KZT"
            />
            <span className="mx-auto text-text-disabled">
              <Icon name="notifications_active" size={22} />
            </span>
            <AmountBox
              label={t('perOneLabel')}
              value="1"
              readOnly
              currency={createdForeign}
            />
          </div>

          {snapshotRate > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-text-default">
              {t('ecashRateAtCreation')}
              <span className="rounded-full bg-surface-page-surf2 px-3 py-1.5 font-medium text-text-disabled">
                {formatNumber(snapshotRate, locale)} ₸ = 1 {currencySymbol(createdForeign)}
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
    // AuthModal рендерится вне <form> — иначе её собственная форма входа
    // окажется вложенной в эту, а вложенные <form> — невалидный HTML
    <>
    <form onSubmit={submit} className="container-page flex flex-col gap-5 pt-6" noValidate>
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

      <section className="rounded-2xl bg-surface-page-surf1 p-5 sm:rounded-3xl sm:p-8">
        <h1 className="text-xl font-bold text-text-default sm:text-[28px]">{t('pairTitle')}</h1>

        <div className="mt-5 flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
          <AmountBox
            label={t('targetLabel')}
            value={rate}
            onChange={(v) => setRate(v.replace(/[^\d\s.,]/g, '').slice(0, 10))}
            currency="KZT"
            invalid={showErrors && !rateValid}
          />
          <span className="mx-auto text-text-disabled">
            <Icon name="notifications_active" size={22} />
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

        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-text-default">
          {t('currentRate')}
          {ratesQ.isPending ? (
            <span className="h-7 w-32 animate-pulse rounded-full bg-surface-page-surf2" />
          ) : currentRate > 0 ? (
            <span className="rounded-full bg-brand-hardsoft px-3 py-1.5 font-medium text-text-brand">
              {formatNumber(currentRate, locale)} ₸ = 1 {currencySymbol(foreign)}
            </span>
          ) : (
            <span className="text-text-disabled">{errorText('errors.RATES_NOT_FOUND')}</span>
          )}
        </div>
      </section>

      <section className="rounded-2xl bg-surface-page-surf1 p-5 sm:rounded-3xl sm:p-8">
        <h2 className="text-lg font-bold text-text-default sm:text-2xl">{t('untilTitle')}</h2>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Select менять нельзя — рамку ошибки даёт контейнер вокруг него */}
          <div
            className={clsx(
              'rounded-2xl border',
              showErrors && day === null ? 'border-negative' : 'border-transparent',
            )}
          >
            <Select
              label={t('day')}
              value={day}
              onChange={setDay}
              placeholder={t('day')}
              options={days.map((d) => ({ value: d, label: d }))}
            />
          </div>
          <div
            className={clsx(
              'rounded-2xl border',
              showErrors && month === null ? 'border-negative' : 'border-transparent',
            )}
          >
            <Select
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
              'rounded-2xl border',
              showErrors && year === null ? 'border-negative' : 'border-transparent',
            )}
          >
            <Select
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
      </section>

      {/* Покупаю/Продаю — отдельной секцией под датой (по макету): от
          направления зависит, какой курс отслеживаем — продажи обменника
          (я покупаю) или покупки (я продаю) */}
      <section className="rounded-2xl bg-surface-page-surf1 p-5 sm:rounded-3xl sm:p-8">
        <h2 className="text-lg font-bold text-text-default sm:text-2xl">{t('typeTitle')}</h2>
        <div role="radiogroup" aria-label={t('typeTitle')} className="mt-5 flex flex-col gap-4">
          <OperationRadio label={t('buying')} checked={buying} onSelect={() => setBuying(true)} />
          <OperationRadio label={t('selling')} checked={!buying} onSelect={() => setBuying(false)} />
        </div>

        {!authed && (
          <p className="mt-4 text-sm text-text-disabled" role="note">
            {t('loginToSubscribe')}
          </p>
        )}

        <Button type="submit" className="mt-6 w-full sm:w-auto sm:min-w-52" disabled={create.isPending}>
          {t('cta')}
        </Button>
      </section>
    </form>
    <AuthModal
      open={authModalOpen}
      onClose={() => setAuthModalOpen(false)}
      onAuthed={() => {
        // сессионная кука уже настоящая к этому моменту (её выставил ответ
        // логина) — не ждём, пока это подтвердит собственный useAuth()
        setAuthModalOpen(false);
        tryCreate();
      }}
    />
    </>
  );
}
