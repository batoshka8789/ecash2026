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

/**
 * «dropdown date»: та же плитка surf2, что у полей суммы — обычный Select
 * в этом месте темнее (bg-transparent), здесь нужна заливка и высота 66 с 768.
 */
const dateSelectBtn = (invalid: boolean) =>
  clsx(
    'md:h-[66px]! bg-surface-page-surf2! hover:border-stroke-surface3!',
    invalid ? 'border-negative!' : 'border-surface-page-surf2!',
  );

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
  /** «Ваша заявка» — общий для всех ответов на заявку заголовок */
  const td = useTranslations('flows.done');
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
      // «Frame 1437255180» — шапка ответа и блок «Ваша заявка» колонкой с
      // зазором 60 (40 ниже 768). Ниже 768 карточки идут в край, боковые
      // поля остаются только у текста.
      <div className="container-page bleed-mobile flex flex-col gap-10 pt-8 md:gap-15">
        <div className="flex flex-col items-center gap-10">
          <div role="status" aria-live="polite" className="flex flex-col items-center text-center">
            {/* «request UI» — блок 184 (224 с 768) с кругом 120 по центру:
                над и под кругом остаётся 32 (52 с 768) */}
            <span className="flex h-[184px] items-center md:h-[224px]">
              <span className="flex h-30 w-30 items-center justify-center rounded-full bg-brand-hardsoft">
                <Icon name="verified_user" size={80} filled className="text-brand" />
              </span>
            </span>
            <h1 className="text-lg font-medium leading-[1.2] text-text-default md:text-[32px]">
              {t('successTitle')}
            </h1>
          </div>

          {removeError && (
            <p role="alert" className="text-center text-sm text-text-negative">
              {removeError}
            </p>
          )}

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button
              variant="brand-outline"
              onClick={() => removeMut.mutate(created.id)}
              disabled={removeMut.isPending}
              className="min-w-[217px]"
            >
              {t('disable')}
            </Button>
            <Button
              onClick={() => router.push('/')}
              disabled={removeMut.isPending}
              className="min-w-[217px]"
            >
              {t('toHome')}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4 pb-6 md:gap-6">
          <div className="flex flex-col gap-1 px-6 md:gap-2 md:px-0">
            <h2 className="text-lg font-medium leading-[1.2] text-text-default md:text-[32px]">
              {td('yourRequest')}
            </h2>
            <p className="text-sm leading-[15.4px] text-text-disabled md:text-base md:leading-[1.24]">
              {`${t('sentAtLabel')}: ${formatDateTime(created.createdAt, locale)}`}
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <section className="rounded-[22px] border border-stroke-surface1 bg-surface-page-surf1 p-4 md:rounded-[28px] md:p-8">
              <h3 className="text-lg font-medium leading-[1.2] text-text-default md:text-[32px]">
                {t('pairTitle')}
              </h3>

              <div className="mt-5 flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
                <AmountBox
                  label={t('targetLabel')}
                  value={formatNumber(created.targetRate, locale)}
                  readOnly
                  currency="KZT"
                />
                <span className="mx-auto flex h-6 w-6 items-center justify-center text-text-disabled">
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
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-default">
                  <span className="text-xs font-medium leading-[15.6px] md:text-sm md:leading-[15.4px]">
                    {t('ecashRateAtCreation')}
                  </span>
                  <span className="rounded-xl bg-surface-page-surf2 px-3 py-1 leading-[15.4px] text-[#878787]">
                    {formatNumber(snapshotRate, locale)} ₸ = 1 {currencySymbol(createdForeign)}
                  </span>
                </div>
              )}
            </section>

            <section className="rounded-[22px] border border-stroke-surface1 bg-surface-page-surf1 p-4 md:rounded-[28px] md:p-8">
              <h3 className="text-lg font-medium leading-[1.2] text-text-default md:text-[32px]">
                {t('dateTitle')}
              </h3>
              <p className="mt-6 font-inter text-sm font-semibold leading-[14px] text-text-disabled md:mt-10">
                {`${t('notifyUntil')}:`}
              </p>
              <p className="mt-2 text-base font-semibold leading-5 text-text-default">
                {untilDate}
              </p>
            </section>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------- форма
  return (
    // AuthModal рендерится вне <form> — иначе её собственная форма входа
    // окажется вложенной в эту, а вложенные <form> — невалидный HTML
    <>
    <form
      onSubmit={submit}
      className="container-page bleed-mobile flex flex-col gap-1 pt-8"
      noValidate
    >
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

        {/* Блок ниже — общий рисунок поля суммы (см. AmountBox в PairFields) */}
        <div className="mt-5 flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
          <AmountBox
            label={t('targetLabel')}
            value={rate}
            onChange={(v) => setRate(v.replace(/[^\d\s.,]/g, '').slice(0, 10))}
            currency="KZT"
            invalid={showErrors && !rateValid}
          />
          <span className="mx-auto flex h-6 w-6 items-center justify-center text-text-disabled">
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

        <div className="mt-3 flex flex-wrap items-center gap-3 text-text-default">
          <span className="text-xs font-medium leading-[15.6px] md:text-sm md:leading-5">
            {`${t('currentRate')}:`}
          </span>
          {ratesQ.isPending ? (
            <span className="h-[23px] w-32 animate-pulse rounded-xl bg-surface-page-surf2" />
          ) : currentRate > 0 ? (
            <span className="rounded-xl bg-surface-page-surf2 px-3 py-1 text-sm leading-[15.4px] text-[#878787]">
              {formatNumber(currentRate, locale)} ₸ = 1 {currencySymbol(foreign)}
            </span>
          ) : (
            <span className="text-sm leading-[15.4px] text-text-disabled">
              {errorText('errors.RATES_NOT_FOUND')}
            </span>
          )}
        </div>
      </section>

      <section className="rounded-[22px] border border-stroke-surface1 bg-surface-page-surf1 p-4 md:rounded-[28px] md:p-8">
        <h2 className="text-lg font-medium leading-[1.2] text-text-default md:text-[32px]">
          {t('dateTitle')}
        </h2>
        <div className="mt-6 md:mt-10">
          <p className="font-inter text-sm font-semibold leading-[14px] text-text-disabled">
            {`${t('notifyUntil')}:`}
          </p>
          {/* подписи полей скрыты визуально: над группой уже стоит общая */}
          <div className="mt-2 grid grid-cols-3 gap-1 md:w-[404px] [&_[id$='-label']]:sr-only">
            <Select
              buttonClassName={dateSelectBtn(showErrors && day === null)}
              label={t('day')}
              value={day}
              onChange={setDay}
              placeholder={t('day')}
              options={days.map((d) => ({ value: d, label: d }))}
            />
            <Select
              buttonClassName={dateSelectBtn(showErrors && month === null)}
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
            <Select
              buttonClassName={dateSelectBtn(showErrors && year === null)}
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
      <section className="rounded-[22px] border border-stroke-surface1 bg-surface-page-surf1 p-4 md:rounded-[28px] md:p-8">
        <h2 className="text-lg font-medium leading-[1.2] text-text-default md:text-[32px]">
          {t('typeTitle')}
        </h2>
        <div role="radiogroup" aria-label={t('typeTitle')} className="mt-6 flex flex-col gap-4 md:mt-10">
          <OperationRadio label={t('buying')} checked={buying} onSelect={() => setBuying(true)} />
          <OperationRadio label={t('selling')} checked={!buying} onSelect={() => setBuying(false)} />
        </div>

        {!authed && (
          <p className="mt-4 text-sm text-text-disabled" role="note">
            {t('loginToSubscribe')}
          </p>
        )}

        <Button type="submit" className="mt-6 w-full md:mt-8 md:w-auto" disabled={create.isPending}>
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
