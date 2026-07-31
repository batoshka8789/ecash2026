'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Toast } from '@/components/ui/Toast';
import { AuthModal } from '@/components/auth/AuthModal';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useErrorText } from '@/lib/useErrorText';
import { useNearestDepId, useUserPlace } from '@/lib/user-place';
import { almatyTime, haversineKm, isHappyHours, isOpenNow, type BadgeKind } from '@/lib/branch-status';
import { currencyName, currencySymbol, formatNumber, formatPhoneInput } from '@/lib/format';
import { counterAmount } from '@/lib/exchange';
import { sortCurrencyCodes } from '@/lib/currency-order';
import type { ExchangeRequest } from '@/lib/domain';
import { AmountBox, BranchAddress, BanknotesPicker, type BranchOption } from './PairFields';
import { RateGraph, RateGraphToggle, type Period } from '@/components/sections/RateGraph';

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
  const [graphOpen, setGraphOpen] = useState(false);
  const [period, setPeriod] = useState<Period>('year');
  const graphId = useId();
  const { coords: userCoords } = useUserPlace();

  // Статус «Открыто/Закрыто» не протухает на долго открытой вкладке.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

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
  const bestOffer = kztGive ? bestQ.data?.best.bestSale : bestQ.data?.best.bestBuy;
  const betterOffer = useMemo(() => {
    if (rate <= 0) return null;
    if (!bestOffer || bestOffer.depId === depId) return null;
    const better = kztGive ? bestOffer.rate < rate : bestOffer.rate > rate;
    return better ? bestOffer : null;
  }, [bestOffer, kztGive, rate, depId]);

  const department = depQ.data?.department ?? null;
  const timetable = department?.timetable ?? null;
  const hhmm = almatyTime.format(nowMs);

  /** км до отделения от «Моего адреса» — та же формула, что и на /locations. */
  const distanceKm = useMemo(
    () => (userCoords && department?.coords ? haversineKm(userCoords, department.coords) : null),
    [userCoords, department],
  );
  const open = timetable ? isOpenNow(timetable, hhmm) : null;

  /** Бейджи карточки: «Ближе всего» — совпадает с гео-ближайшим отделением;
   *  «Самый выгодный» — у него реально лучший курс по сети (нет better Offer
   *  и bestQ указывает именно на него); «Happy hours» — по расписанию. */
  const badges = useMemo(() => {
    const list: BadgeKind[] = [];
    if (bestOffer && bestOffer.depId === depId && rate > 0) list.push('best');
    if (timetable && isHappyHours(timetable, hhmm)) list.push('happyHours');
    if (depId === nearestDep) list.push('nearest');
    return list;
  }, [bestOffer, depId, rate, timetable, hhmm, nearestDep]);

  /** Список для «Изменить» — первым идёт отделение, ближайшее к «Моему
   *  адресу» (nearestDep), остальные следом в исходном порядке апстрима. */
  const departmentOptions = useMemo<BranchOption[]>(() => {
    const deps = depsQ.data?.departments ?? [];
    const opts = deps.map((d) => ({ depId: d.depId, label: d.code || d.address, hint: d.address }));
    const nearestIdx = opts.findIndex((o) => o.depId === nearestDep);
    if (nearestIdx > 0) {
      const [pinned] = opts.splice(nearestIdx, 1);
      opts.unshift(pinned);
    }
    return opts;
  }, [depsQ.data, nearestDep]);

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
        {/* «Frame 1437255029» 486:17941 — заголовок и вторичная кнопка в строку
            46px с 768; ниже — колонкой с зазором 12 («Frame 1437255032») */}
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
          <div className="min-w-0">
            <h1 className="text-lg font-medium leading-[1.2] text-text-default md:text-[32px]">
              {t('pair.title')}
            </h1>
            {mode === 'individual' && (
              <p className="mt-2 max-w-[576px] text-xs leading-[1.3] text-text-disabled md:mt-4 md:text-base md:font-medium md:leading-5">
                {t('pair.individualHint')}
              </p>
            )}
          </div>
          {/* «a-button-main» secondary (инстанс 1000:38461 на экране брони) — та же
              кнопка «Динамика курса», что и в калькуляторе (2003:133396):
              рендер реального фрейма Figma показал, что здесь стоит не
              выбор отделения, а именно переключатель графика; отделение
              выбирается ниже, в блоке «Адрес» (историческое ближайшее +
              плашка «в другом отделении выгоднее»). */}
          <RateGraphToggle
            open={graphOpen}
            onToggle={() => setGraphOpen((v) => !v)}
            graphId={graphId}
            label={t('pair.dynamics')}
          />
        </div>

        {graphOpen && (
          <div id={graphId} className="anim-chart-panel overflow-hidden">
            <RateGraph depId={depId} code={foreign} period={period} setPeriod={setPeriod} />
          </div>
        )}

        <div className="relative mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
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
            /* поля стоят колонкой до lg — кнопка чипом ложится на стык полей;
               с lg поля в ряд, и она превращается в голую иконку */
            className="absolute left-1/2 top-1/2 z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-stroke-modal bg-surface-page-surf2 text-text-default shadow-[0_1px_4px_rgb(12_12_13/0.05),0_1px_4px_rgb(12_12_13/0.1)] transition-colors hover:bg-comp-surface2-hover lg:static lg:mx-auto lg:h-10 lg:w-10 lg:translate-x-0 lg:translate-y-0 lg:rounded-full lg:border-0 lg:bg-transparent lg:shadow-none lg:hover:bg-comp-surface1-hover"
          >
            <motion.span
              animate={{ rotate: kztGive ? 0 : 180 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="flex"
            >
              {/* material-symbols-rounded подключён без @layer в layout.tsx —
                  его display:inline-block перебивает hidden/lg:block той же
                  специфичности, нужен важность-модификатор (см. CurrencyFlag) */}
              <Icon name="swap_vert" size={18} className="lg:hidden!" />
              <Icon name="sync_alt" size={20} className="max-lg:hidden!" />
            </motion.span>
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

        {/* «Frame 1437254966» — строка курса 23px: подпись и бейдж с зазором 12.
            Подпись: 12/1.3 Medium ниже 768; с 768 — 14, в брони 20, в индив.
            курсе Regular 15.4 (486:22393 против 1004:45486) */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-text-default">
          <span
            className={
              'text-xs font-medium leading-[15.6px] md:text-sm ' +
              (mode === 'individual' ? 'md:font-normal md:leading-[15.4px]' : 'md:leading-5')
            }
          >
            {`${t('pair.currentRate')}:`}
          </span>
          {ratesQ.isPending ? (
            <span className="h-[23px] w-32 animate-pulse rounded-xl bg-surface-page-surf2" />
          ) : rate > 0 ? (
            /* «badge» 828:32967 — 4/12, r12, текст 14/15.4 цветом #878787 */
            <span className="rounded-xl bg-surface-page-surf2 px-3 py-1 text-sm leading-[15.4px] text-[#878787]">
              {tr('perUnit', { rate: formatNumber(rate, locale), code: currencySymbol(foreign) })}
            </span>
          ) : (
            <span className="text-sm leading-[15.4px] text-text-disabled">
              {errorText('errors.RATES_NOT_FOUND')}
            </span>
          )}
        </div>

        {/* Поле «Желаемый курс» убрано по требованию заказчика: курс назначает
            казначей, и запрошенное клиентом значение всё равно не влияло на
            результат — только создавало ложное ожидание. */}

        {/* «Rectangle 555» 415:23783 — разделитель 1px divider/hole, отступы 24/28 */}
        <div className="mt-6 border-t border-divider-hole pt-6 md:mt-7 md:pt-7">
          <BranchAddress
            department={department}
            distanceKm={distanceKm}
            open={open}
            badges={badges}
            betterOffer={betterOffer}
            onPickBetter={setDepId}
            departments={departmentOptions}
            depId={depId}
            onChangeDep={setDepId}
          />
        </div>
      </section>

      <BanknotesPicker value={banknotes} onChange={setBanknotes} />

      <section className="rounded-[22px] border border-stroke-surface1 bg-surface-page-surf1 p-4 md:rounded-[28px] md:p-8">
        <h2 className="text-lg font-medium leading-[1.2] text-text-default md:text-[32px]">
          {t('data.title')}
        </h2>
        {/* «Frame 1437255410»: в брони поля встают в строку с 480 (1783:128506),
            в индивидуальном курсе — только с 768 (1784:142488 — колонка) */}
        <div
          className={
            'mt-6 flex flex-col gap-2 md:mt-10 md:flex-row ' +
            (mode === 'booking' ? 'min-[480px]:flex-row' : '')
          }
        >
          {/* «Input» 898:34257 — 280×54 на десктопе, растяжка на мобиле */}
          <div className="flex-1 md:max-w-[280px]">
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
              className={inputCls}
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
              className={inputCls}
            />
          </div>
        </div>

        {mode === 'booking' && (
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm leading-[15.4px] text-text-disabled md:mt-3 md:leading-5">
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

        {/* Сумма обязательна: кнопка недоступна, пока её не ввели, — раньше
            операцию можно было отправить с пустым полем и узнать об ошибке
            только из тоста. Подпись ниже объясняет, почему кнопка неактивна. */}
        <Button
          type="submit"
          className="mt-6 w-full md:mt-8 md:w-auto"
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

/**
 * «Input» 883:33235 — 54×r20, обводка #4C4C4C; плейсхолдер Inter Semi Bold
 * 16/21 #6B6B6B, заполненное значение Roboto SemiBold 16/20 #EEEEEE.
 * Состояния из набора 885:33279/33285: hover — заливка surf2 и обводка
 * #616161, focus — обводка #EEEEEE (варианта disabled в макете нет).
 */
const inputCls =
  'h-[54px] w-full rounded-[20px] border border-surface-page-surf3 bg-transparent px-4 text-base' +
  ' font-semibold leading-5 text-text-default outline-none transition-colors' +
  ' placeholder:font-inter placeholder:font-semibold placeholder:leading-[21px] placeholder:text-text-disabled' +
  ' hover:border-stroke-input-hover hover:bg-surface-page-surf2 focus:border-text-default';
