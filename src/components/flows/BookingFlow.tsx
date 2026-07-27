'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Toast } from '@/components/ui/Toast';
import { Select } from '@/components/ui/Select';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useErrorText } from '@/lib/useErrorText';
import { currencyName, currencySymbol, formatNumber } from '@/lib/format';
import type { ExchangeRequest } from '@/lib/domain';
import { AmountBox, BranchAddress, BanknotesPicker } from './PairFields';

type Mode = 'booking' | 'individual';

const DEFAULT_DEP = 1;

/**
 * Флоу «Забронировать курс» и «Запросить индивидуальный курс» — по реальному
 * контракту /mobile/reserve: value = сумма в валюте, amount = сумма в тенге,
 * направление по правилу currencyFrom ≠ KZT → покупка у клиента.
 * После отправки — переход на карточку /requests/[id]: заявка живёт в статусе 0
 * до ответа казначея, бронь (60 мин) начинается с его ответа.
 */
export function BookingFlow({ mode }: { mode: Mode }) {
  const t = useTranslations('flows');
  const tr = useTranslations('rates');
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const { account, authed } = useAuth();
  const errorText = useErrorText();

  // пара: одна сторона всегда KZT (модель курсов Ecash)
  const paramTo = params.get('to');
  const paramFrom = params.get('from');
  const initialForeign =
    paramFrom && paramFrom !== 'KZT' ? paramFrom : paramTo && paramTo !== 'KZT' ? paramTo : 'USD';
  /** true: клиент отдаёт тенге и получает валюту (продажа обменником) */
  const initialKztGive = paramFrom ? paramFrom === 'KZT' : true;

  const [foreign, setForeign] = useState(initialForeign);
  const [kztGive, setKztGive] = useState(initialKztGive);
  const [give, setGive] = useState(params.get('amount') ?? '');
  const [depId, setDepId] = useState(Number(params.get('depId')) || DEFAULT_DEP);
  const [banknotes, setBanknotes] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [desiredRate, setDesiredRate] = useState('');
  const [individual, setIndividual] = useState(mode === 'individual');
  const [showErrors, setShowErrors] = useState(false);
  const [duplicate, setDuplicate] = useState<ExchangeRequest | null>(null);

  const depsQ = useQuery({
    queryKey: ['departments'],
    queryFn: ({ signal }) => api.departments.list(signal),
    staleTime: 5 * 60_000,
  });
  const depQ = useQuery({
    queryKey: ['department', depId],
    queryFn: ({ signal }) => api.departments.info(depId, signal),
    staleTime: 5 * 60_000,
  });
  const ratesQ = useQuery({
    queryKey: ['rates', depId],
    queryFn: ({ signal }) => api.rates.forDep(depId, signal),
    staleTime: 60_000,
  });
  const bestQ = useQuery({
    queryKey: ['rates', 'best', foreign],
    queryFn: ({ signal }) => api.rates.best(foreign, undefined, signal),
    staleTime: 60_000,
  });

  const stat = ratesQ.data?.rates.find((r) => r.currencyCode === foreign);
  // клиент отдаёт валюту → обменник ПОКУПАЕТ (buy); отдаёт тенге → обменник ПРОДАЁТ (sell)
  const rate = stat ? (kztGive ? stat.sell : stat.buy) : 0;

  /** Тизер «в другом отделении выгоднее»: kztGive — сравниваем с bestSale
   *  (обменник продаёт дешевле = выгоднее клиенту), иначе — с bestBuy
   *  (обменник покупает дороже = выгоднее клиенту). Только если это другое
   *  отделение и оно реально выгоднее текущего курса. */
  const betterOffer = useMemo(() => {
    if (rate <= 0) return null;
    const offer = kztGive ? bestQ.data?.best.bestSale : bestQ.data?.best.bestBuy;
    if (!offer || offer.depId === depId) return null;
    const better = kztGive ? offer.rate < rate : offer.rate > rate;
    return better ? offer : null;
  }, [bestQ.data, kztGive, rate, depId]);

  const amountNum = useMemo(
    () => parseFloat(give.replace(/[\s ]/g, '').replace(',', '.')),
    [give],
  );
  const validAmount = Number.isFinite(amountNum) && amountNum > 0;

  /** value — сумма в валюте, amount — в тенге */
  const { value, amount } = useMemo(() => {
    if (!validAmount || rate <= 0) return { value: 0, amount: 0 };
    return kztGive
      ? { value: amountNum / rate, amount: amountNum }
      : { value: amountNum, amount: amountNum * rate };
  }, [validAmount, rate, kztGive, amountNum]);

  const get = useMemo(() => {
    if (mode === 'individual' || individual) return t('pair.underReview');
    if (!validAmount || rate <= 0) return '';
    return kztGive
      ? `${formatNumber(value, locale)} ${currencySymbol(foreign)}`
      : `${formatNumber(amount, locale)} ₸`;
  }, [mode, individual, validAmount, rate, kztGive, value, amount, foreign, locale, t]);

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

  const create = useMutation({
    mutationFn: () => {
      const desired = parseFloat(desiredRate.replace(/[\s ]/g, '').replace(',', '.'));
      const isInd = mode === 'individual' || individual;
      const effRate = isInd && Number.isFinite(desired) && desired > 0 ? desired : rate;
      const effValue = kztGive ? amountNum / effRate : amountNum;
      const effAmount = kztGive ? amountNum : amountNum * effRate;
      const comment = banknotes ? t(`banknotes.${banknotes as 'small' | 'large'}`) : undefined;
      const payload = {
        currencyFrom: kztGive ? 'KZT' : foreign,
        currencyTo: kztGive ? foreign : 'KZT',
        value: round2(effValue),
        rate: round2(effRate),
        amount: Math.round(effAmount),
        depId,
        fullName: name.trim() || undefined,
        comment,
      };
      return isInd ? api.requests.createIndividual(payload) : api.requests.create(payload);
    },
    onSuccess: (res) => {
      router.replace(`/requests/${res.request.requestId}`);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.data && typeof e.data === 'object') {
        const existing = e.data as ExchangeRequest;
        if (existing.requestId) {
          setDuplicate(existing);
          return;
        }
      }
      setShowErrors(true);
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!authed) {
      router.push('/login');
      return;
    }
    if (!validAmount || rate <= 0) {
      setShowErrors(true);
      return;
    }
    create.mutate();
  };

  const createError =
    create.error instanceof ApiError ? errorText(create.error.message) : null;

  return (
    <form onSubmit={submit} className="container-page bleed-mobile flex flex-col gap-1 pt-8" noValidate>
      <Toast
        open={showErrors}
        tone="negative"
        onClose={() => setShowErrors(false)}
        closeLabel={t('close')}
      >
        {createError ?? t('fillRequired')}
      </Toast>
      <Toast
        open={duplicate !== null}
        tone="negative"
        onClose={() => setDuplicate(null)}
        closeLabel={t('close')}
        action={
          duplicate
            ? { label: t('openExisting'), onClick: () => router.push(`/requests/${duplicate.requestId}`) }
            : undefined
        }
      >
        {errorText('errors.REQUEST_ALREADY_EXISTS')}
      </Toast>

      <section className="rounded-[22px] border border-stroke-surface1 bg-surface-page-surf1 p-4 md:rounded-[28px] md:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-lg font-medium leading-[1.2] text-text-default md:text-[32px]">
              {t('pair.title')}
            </h1>
            {mode === 'individual' && (
              <p className="mt-3 max-w-[576px] text-sm font-medium leading-5 text-text-disabled md:mt-4 md:text-base">
                {t('pair.individualHint')}
              </p>
            )}
          </div>
        </div>

        <div className="relative mt-6 flex flex-col gap-2 md:mt-10 md:flex-row md:items-center md:gap-3">
          <AmountBox
            label={`${t('pair.give')} (${kztGive ? '₸' : currencySymbol(foreign)})`}
            value={give}
            onChange={(v) => setGive(v.replace(/[^\d\s.,]/g, '').slice(0, 15))}
            currency={kztGive ? 'KZT' : foreign}
            currencyOptions={kztGive ? undefined : currencyOptions}
            onCurrencyChange={kztGive ? undefined : setForeign}
            invalid={showErrors && !validAmount}
          />
          <button
            type="button"
            onClick={() => setKztGive((v) => !v)}
            aria-label={t('pair.swap')}
            /* мобильный фрейм 1783:128461 — кнопка 36×36 r20 на surf2 с обводкой;
               с 768px (1783:127076) остаётся голая иконка 20×20 */
            className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 shrink-0 cursor-pointer items-center justify-center rounded-[20px] border border-stroke-modal bg-surface-page-surf2 p-2 text-text-default shadow-[0_1px_4px_rgba(12,12,13,0.1)] transition-colors hover:bg-comp-surface2-hover md:static md:mx-auto md:translate-x-0 md:translate-y-0 md:rounded-full md:border-0 md:bg-transparent md:p-0 md:shadow-none md:hover:bg-transparent md:hover:text-text-brand"
          >
            <Icon name={mode === 'individual' ? 'arrow_forward' : 'sync_alt'} size={20} />
          </button>
          <AmountBox
            label={`${t('pair.get')} (${kztGive ? currencySymbol(foreign) : '₸'})`}
            value={get}
            readOnly
            currency={kztGive ? foreign : 'KZT'}
            currencyOptions={kztGive ? currencyOptions : undefined}
            onCurrencyChange={kztGive ? setForeign : undefined}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-text-default">
          {t('pair.currentRate')}
          {ratesQ.isPending ? (
            <span className="h-[23px] w-32 animate-pulse rounded-xl bg-surface-page-surf2" />
          ) : rate > 0 ? (
            <span className="rounded-xl bg-surface-page-surf2 px-3 py-1 text-text-disabled">
              {tr('perUnit', { rate: formatNumber(rate, locale), code: currencySymbol(foreign) })}
            </span>
          ) : (
            <span className="text-text-disabled">{errorText('errors.RATES_NOT_FOUND')}</span>
          )}
        </div>

        {(mode === 'individual' || individual) && (
          <div className="mt-5 max-w-xs">
            <label htmlFor="desired-rate" className="mb-2 block text-sm font-semibold text-text-disabled">
              {t('pair.desiredRate')}
            </label>
            <input
              id="desired-rate"
              value={desiredRate}
              onChange={(e) => setDesiredRate(e.target.value.replace(/[^\d\s.,]/g, '').slice(0, 10))}
              inputMode="decimal"
              placeholder={rate > 0 ? formatNumber(rate, locale) : ''}
              className="h-[54px] w-full rounded-[20px] border border-surface-page-surf3 bg-transparent px-4 text-base font-semibold text-text-default outline-none placeholder:font-normal placeholder:text-text-disabled focus:border-stroke-brand"
            />
          </div>
        )}

        {/* «Rectangle 555» 415:23783 — разделитель 1px divider/hole, отступы 24/28 */}
        <div className="mt-6 border-t border-divider-hole pt-6 md:mt-7 md:pt-7">
          <div className="mb-5 max-w-md">
            <Select
              label={t('address.title')}
              value={String(depId)}
              onChange={(v) => setDepId(Number(v))}
              options={(depsQ.data?.departments ?? []).map((d) => ({
                value: String(d.depId),
                label: d.code || d.address,
                hint: d.address,
              }))}
            />
          </div>
          <BranchAddress
            department={depQ.data?.department ?? null}
            betterOffer={betterOffer}
            onPickBetter={setDepId}
          />
        </div>
      </section>

      <BanknotesPicker value={banknotes} onChange={setBanknotes} />

      <section className="rounded-[22px] border border-stroke-surface1 bg-surface-page-surf1 p-4 md:rounded-[28px] md:p-8">
        <h2 className="text-lg font-medium leading-[1.2] text-text-default md:text-[32px]">
          {t('data.title')}
        </h2>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row md:mt-10">
          {/* «Input» 898:34257 — 280×54 на десктопе, растяжка на мобиле */}
          <div className="flex-1 md:max-w-[280px]">
            <label htmlFor="bf-phone" className="sr-only">
              {t('data.phone')}
            </label>
            <input
              id="bf-phone"
              value={account?.phoneNumber ?? ''}
              readOnly
              placeholder={t('data.phone')}
              inputMode="tel"
              title={t('data.phoneFromAccount')}
              className="h-[54px] w-full rounded-[20px] border border-surface-page-surf3 bg-transparent px-4 text-base font-semibold text-text-disabled outline-none"
            />
            <p className="mt-1 pl-1 text-xs text-text-disabled">{t('data.phoneFromAccount')}</p>
          </div>
          {/* «Input» 898:34257 — 280×54 на десктопе, растяжка на мобиле */}
          <div className="flex-1 md:max-w-[280px]">
            <label htmlFor="bf-name" className="sr-only">
              {t('data.name')}
            </label>
            <input
              id="bf-name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 120))}
              placeholder={t('data.name')}
              autoComplete="name"
              className="h-[54px] w-full rounded-[20px] border border-surface-page-surf3 bg-transparent px-4 text-base font-semibold text-text-default outline-none placeholder:font-normal placeholder:text-text-disabled focus:border-stroke-brand"
            />
          </div>
        </div>

        {mode === 'booking' && (
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-text-disabled">
            <input
              type="checkbox"
              checked={individual}
              onChange={(e) => setIndividual(e.target.checked)}
              className="peer sr-only"
            />
            <span
              className={
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand ' +
                (individual
                  ? 'border-transparent bg-brand text-text-always-white'
                  : 'border-surface-page-surf3 text-transparent')
              }
            >
              <Icon name="check" size={16} />
            </span>
            {t('data.requestIndividual')}
          </label>
        )}

        {!authed && (
          <p className="mt-4 text-sm text-text-disabled" role="note">
            {t('data.loginToBook')}
          </p>
        )}

        <Button
          type="submit"
          className="mt-6 w-full md:mt-8 md:w-auto"
          disabled={create.isPending}
        >
          {mode === 'individual' || individual ? t('data.requestIndividualCta') : t('data.book')}
        </Button>
      </section>
    </form>
  );
}

const round2 = (n: number) => Math.round(n * 100) / 100;
