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
import { AuthModal } from '@/components/auth/AuthModal';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useErrorText } from '@/lib/useErrorText';
import { useNearestDepId } from '@/lib/user-place';
import { currencyName, currencySymbol, formatNumber, formatPhoneInput } from '@/lib/format';
import { counterAmount } from '@/lib/exchange';
import { sortCurrencyCodes } from '@/lib/currency-order';
import type { ExchangeRequest } from '@/lib/domain';
import { AmountBox, BranchAddress, BanknotesPicker } from './PairFields';

type Mode = 'booking' | 'individual';

const DEFAULT_DEP = 1;

/**
 * Флоу «Забронировать курс» и «Запросить индивидуальный курс» — по реальному
 * контракту /mobile/reserve: value = сумма в currencyFrom (что отдаём),
 * amount = сумма в currencyTo (что получаем), направление по правилу
 * currencyFrom ≠ KZT → покупка у клиента.
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
  // Отделение: из URL (пришли из карточки отделения), иначе — ближайшее
  // к «Моему адресу»; пока адрес не геокодирован — историческое №1.
  const paramDep = Number(params.get('depId')) || null;
  const { depId: nearestDep } = useNearestDepId(DEFAULT_DEP);
  const [pickedDep, setPickedDep] = useState<number | null>(paramDep);
  const depId = pickedDep ?? nearestDep;
  const setDepId = setPickedDep;
  const [banknotes, setBanknotes] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [individual, setIndividual] = useState(mode === 'individual');
  const [showErrors, setShowErrors] = useState(false);
  const [duplicate, setDuplicate] = useState<ExchangeRequest | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

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

  /**
   * По контракту Ecash (раздел 4.3 ответа по интеграции, карточка заявки):
   * value — сколько клиент ОТДАЁТ, в currencyFrom; amount — сколько
   * ПОЛУЧАЕТ, в currencyTo. Не «валюта/тенге» — направление в паре может
   * быть любым. Раньше value был жёстко привязан к иностранной валюте,
   * а amount — к тенге: при покупке валюты за тенге (обычный сценарий
   * калькулятора, currencyFrom=KZT) в апстрим уходила бы перепутанная
   * пара — сумма в тенге как value, сумма в валюте как amount, ровно
   * наоборот контракту. Тот же перекос был виден и локально: карточка
   * уведомления показывала «19,72 (KZT)» вместо «10 000 (KZT)».
   */
  const amount = useMemo(() => {
    if (!validAmount) return 0;
    return counterAmount(amountNum, rate, kztGive ? 'KZT' : foreign);
  }, [validAmount, rate, kztGive, amountNum, foreign]);

  /**
   * Эквивалент считается ВСЕГДА, в том числе для индивидуального курса.
   * Раньше здесь возвращалось «На рассмотрении», и человек не видел даже
   * ориентировочной суммы: курс казначея действительно будет другим, но
   * расчёт по текущему курсу — это оценка, а не пустой экран.
   */
  const get = useMemo(() => {
    if (!validAmount || rate <= 0) return '';
    return kztGive
      ? `${formatNumber(amount, locale)} ${currencySymbol(foreign)}`
      : `${formatNumber(amount, locale)} ₸`;
  }, [validAmount, rate, kztGive, amount, foreign, locale]);

  // Порядок общий с калькулятором: тенге сверху, золото в конце
  const currencyOptions = useMemo(
    () =>
      sortCurrencyCodes(
        (ratesQ.data?.rates ?? [])
          .filter((r) => r.currencyCode !== 'KZT' && (r.buy > 0 || r.sell > 0))
          .map((r) => r.currencyCode),
      ).map((code) => ({
        code,
        name: currencyName(code, locale, (g) => tr('gold', { grams: g })),
      })),
    [ratesQ.data, locale, tr],
  );

  const create = useMutation({
    mutationFn: () => {
      const isInd = mode === 'individual' || individual;
      // value — currencyFrom (то, что отдаём), amount — currencyTo (что получаем)
      const effRate = rate;
      const effValue = amountNum;
      const effAmount = counterAmount(amountNum, effRate, kztGive ? 'KZT' : foreign);
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

  /** здесь пользователь уже гарантированно авторизован */
  const tryCreate = () => {
    if (!validAmount || rate <= 0) {
      setShowErrors(true);
      return;
    }
    create.mutate();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!authed) {
      setAuthModalOpen(true);
      return;
    }
    tryCreate();
  };

  const createError =
    create.error instanceof ApiError ? errorText(create.error.message) : null;

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

      <section className="rounded-2xl bg-surface-page-surf1 p-5 sm:rounded-3xl sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-text-default sm:text-[28px]">{t('pair.title')}</h1>
            {mode === 'individual' && (
              <p className="mt-1 max-w-md text-sm text-text-disabled">{t('pair.individualHint')}</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
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
            className="mx-auto cursor-pointer rounded-full p-2 text-text-disabled transition-colors hover:bg-comp-surface1-hover hover:text-text-default"
          >
            <Icon name={mode === 'individual' ? 'arrow_forward' : 'sync_alt'} size={22} />
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

        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-text-default">
          {t('pair.currentRate')}
          {ratesQ.isPending ? (
            <span className="h-7 w-32 animate-pulse rounded-full bg-surface-page-surf2" />
          ) : rate > 0 ? (
            <span className="rounded-full bg-brand-hardsoft px-3 py-1.5 font-medium text-text-brand">
              {tr('perUnit', { rate: formatNumber(rate, locale), code: currencySymbol(foreign) })}
            </span>
          ) : (
            <span className="text-text-disabled">{errorText('errors.RATES_NOT_FOUND')}</span>
          )}
        </div>

        {/* Поле «Желаемый курс» убрано по требованию заказчика: курс назначает
            казначей, и запрошенное клиентом значение всё равно не влияло на
            результат — только создавало ложное ожидание. */}

        <div className="mt-8">
          <div className="mb-3 max-w-md">
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

      <section className="rounded-2xl bg-surface-page-surf1 p-5 sm:rounded-3xl sm:p-8">
        <h2 className="text-lg font-bold text-text-default sm:text-2xl">{t('data.title')}</h2>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label htmlFor="bf-phone" className="sr-only">
              {t('data.phone')}
            </label>
            <input
              id="bf-phone"
              value={account?.phoneNumber ? formatPhoneInput(account.phoneNumber) : ''}
              readOnly
              placeholder={t('data.phone')}
              inputMode="tel"
              title={t('data.phoneFromAccount')}
              className="h-12 w-full rounded-2xl border border-stroke-modal bg-transparent px-4 text-base text-text-disabled outline-none transition-colors focus:border-stroke-brand"
            />
            <p className="mt-1 pl-1 text-xs text-text-disabled">{t('data.phoneFromAccount')}</p>
          </div>
          <div className="flex-1">
            <label htmlFor="bf-name" className="sr-only">
              {t('data.name')}
            </label>
            <input
              id="bf-name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 120))}
              placeholder={t('data.name')}
              autoComplete="name"
              className="h-12 w-full rounded-2xl border border-stroke-modal bg-transparent px-4 text-base text-text-default outline-none placeholder:text-text-disabled focus:border-stroke-brand"
            />
          </div>
        </div>

        {mode === 'booking' && (
          <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm text-text-disabled">
            <input
              type="checkbox"
              checked={individual}
              onChange={(e) => setIndividual(e.target.checked)}
              className="peer sr-only"
            />
            <span
              className={
                'flex h-5 w-5 items-center justify-center rounded-md border transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand ' +
                (individual
                  ? 'border-transparent bg-brand text-text-always-white'
                  : 'border-stroke-surface3 text-transparent')
              }
            >
              <Icon name="check" size={14} />
            </span>
            {t('data.requestIndividual')}
          </label>
        )}

        {!authed && (
          <p className="mt-4 text-sm text-text-disabled" role="note">
            {t('data.loginToBook')}
          </p>
        )}

        {/* Сумма обязательна: кнопка недоступна, пока её не ввели, — раньше
            операцию можно было отправить с пустым полем и узнать об ошибке
            только из тоста. Подпись объясняет, почему кнопка неактивна. */}
        <Button
          type="submit"
          className="mt-6 w-full sm:w-auto sm:min-w-52"
          disabled={create.isPending || !validAmount}
        >
          {mode === 'individual' || individual ? t('data.requestIndividualCta') : t('data.book')}
        </Button>
        {!validAmount && (
          <p className="mt-2 text-sm text-text-disabled">{t('data.amountRequired')}</p>
        )}
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

const round2 = (n: number) => Math.round(n * 100) / 100;
