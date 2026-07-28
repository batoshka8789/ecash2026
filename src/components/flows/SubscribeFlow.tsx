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
const dateSelectBtn = (invalid: boolean) =>
  clsx(
    'md:h-[66px]! bg-surface-page-surf2! hover:border-stroke-surface3!',
    // рамка ошибки — на самой кнопке: обёртка с border отнимала бы 2px ширины
    invalid ? 'border-negative!' : 'border-surface-page-surf2!',
  );

/**
 * «Input time» 1207:69718 — составное поле «часы : минуты»: 101 в ширину,
 * 54 на мобиле и 66 с 768, радиус 20, обводка и заливка surf2.
 */
const TIME_CELL =
  'w-full min-w-0 bg-transparent text-center text-base font-medium leading-5 text-text-default outline-none placeholder:text-text-disabled';

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
  /** «Ваша заявка» — общий для всех ответов на заявку заголовок */
  const td = useTranslations('flows.done');
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
  /** «Input time» — час и минута отсечки; пусто = конец суток (23:59) */
  const [hh, setHh] = useState('');
  const [mm, setMm] = useState('');
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
    month !== null && year !== null ? new Date(Number(year), Number(month) + 1, 0).getDate() : 31;
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
    // время отсечки из «Input time»; незаполненное поле = конец суток
    const h = Math.min(23, Number(hh) || 0);
    const m = Math.min(59, Number(mm) || 0);
    const untilH = hh === '' ? 23 : h;
    const untilM = hh === '' && mm === '' ? 59 : m;
    const until = new Date(Number(year), Number(month), Number(day), untilH, untilM, 59);
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
      // «Frame 1437255180» 1774:159256 — шапка ответа и блок «Ваша заявка»
      // колонкой с зазором 60 (40 ниже 768, фрейм 1780:40846). Ниже 768
      // карточки идут в край, боковые поля остаются только у текста.
      <div className="container-page bleed-mobile flex flex-col gap-10 pt-8 md:gap-15">
        {/* «Frame 1437255170» — иконка с заголовком и кнопка, зазор 40 */}
        <div className="flex flex-col items-center gap-10">
          <div role="status" aria-live="polite" className="flex flex-col items-center text-center">
            {/* «request UI» 1004:32022 — блок 184 (224 с 768) с кругом 120 по
                центру: над и под кругом остаётся 32 (52 с 768).
                «Frame 1437255179» 1004:32016 — круг 120 r70 на бренде 20%
                с иконкой 80; на мобиле те же 120/80 (1780:40849) */}
            <span className="flex h-[184px] items-center md:h-[224px]">
              <span className="flex h-30 w-30 items-center justify-center rounded-full bg-brand-hardsoft">
                <Icon name="verified_user" size={80} filled className="text-brand" />
              </span>
            </span>
            {/* «Frame 1437255172» — заголовок 32/1.2 (18/1.2 ниже 768) */}
            <h1 className="text-lg font-medium leading-[1.2] text-text-default md:text-[32px]">
              {t('successTitle')}
            </h1>
          </div>

          {removeError && (
            <p role="alert" className="text-center text-sm text-text-negative">
              {removeError}
            </p>
          )}

          {/* «a-button-main» 1774:159264 — outline 217×54, по центру и на мобиле
              (1780:40854 — 217×54, не растянута) */}
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

        {/* «Frame 1437255232» — «Ваша заявка» и карточки, зазор 24 (16 ниже 768) */}
        <div className="flex flex-col gap-4 pb-6 md:gap-6">
          {/* «Frame 1437255230» — заголовок и время отправки, зазор 8 (4 ниже
              768); ниже 768 у блока боковые поля 24, карточки идут в край */}
          <div className="flex flex-col gap-1 px-6 md:gap-2 md:px-0">
            <h2 className="text-lg font-medium leading-[1.2] text-text-default md:text-[32px]">
              {td('yourRequest')}
            </h2>
            <p className="text-sm leading-[15.4px] text-text-disabled md:text-base md:leading-[1.24]">
              {`${t('sentAtLabel')}: ${formatDateTime(created.createdAt, locale)}`}
            </p>
          </div>

          {/* «Frame 1437255171» — две карточки с зазором 4 */}
          <div className="flex flex-col gap-1">
            <section className="rounded-[22px] border border-stroke-surface1 bg-surface-page-surf1 p-4 md:rounded-[28px] md:p-8">
              <h3 className="text-lg font-medium leading-[1.2] text-text-default md:text-[32px]">
                {t('pairTitle')}
              </h3>

              <div className="relative mt-6 flex flex-col items-stretch gap-2 md:mt-7 md:flex-row md:items-center md:justify-start md:gap-3">
                <AmountBox
                  className="md:w-[342px] md:flex-none"
                  label={t('targetLabel')}
                  value={formatNumber(created.targetRate, locale)}
                  readOnly
                  currency="KZT"
                />
                <span className="absolute left-1/2 top-1/2 z-10 flex h-9 w-9 shrink-0 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[20px] border border-stroke-modal bg-surface-page-surf2 text-text-default shadow-[0_1px_4px_rgb(12_12_13/0.05),0_1px_4px_rgb(12_12_13/0.1)] md:static md:mx-0 md:h-5 md:w-5 md:translate-x-0 md:translate-y-0 md:rounded-none md:border-0 md:bg-transparent md:shadow-none">
                  <Icon name="sync_alt" size={20} />
                </span>
                <AmountBox
                  className="md:w-[210px] md:flex-none"
                  label={t('perOneLabel')}
                  value="1"
                  readOnly
                  currency={created.currencyTo}
                />
              </div>

              {snapshotRate > 0 && (
                /* «Frame 1437254936» 1780:40866 — подпись и бейдж: зазор 12 в
                   строку и 4 при переносе; текст 12/15.6 Medium ниже 768 и
                   14/15.4 Regular с 768 (1177:57451) */
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-default">
                  <span className="text-xs font-medium leading-[15.6px] md:text-sm md:font-normal md:leading-[15.4px]">
                    {t('ecashRateAtCreation')}
                  </span>
                  <span className="rounded-xl bg-surface-page-surf2 px-3 py-1 leading-[15.4px] text-[#878787]">
                    {formatNumber(snapshotRate, locale)} ₸ = 1 {currencySymbol(created.currencyTo)}
                  </span>
                </div>
              )}
            </section>

            {/* «Calendar «Subscribe» cards» 1774:159271 — дата отсечки */}
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
        {/* «Frame 1437255028» 1177:57327 — заголовок и вторичная кнопка в строку
            46px с 768; ниже 768 — колонкой с зазором 12 («Frame 1437255031») */}
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
          <h1 className="min-w-0 text-lg font-medium leading-[1.2] text-text-default md:text-[32px]">
            {t('pairTitle')}
          </h1>
          {/* «a-button-main» 846:26418 — 191×46 с 768, 163×34 ниже, обводка
              #4C4C4C, подпись 14/20 брендом; за кнопкой — выбор валютной пары */}
          <Select
            className="w-[163px] shrink-0 md:w-[191px] [&>span]:sr-only [&>ul]:w-[289px] [&>ul]:max-w-[calc(100vw-32px)]"
            buttonClassName="h-[34px]! justify-center! px-3! text-sm! text-text-brand! md:h-[46px]! md:px-4!"
            label={t('pairTitle')}
            value={foreign}
            onChange={setForeign}
            options={currencyOptions.map((o) => ({
              value: o.code,
              label: `KZT / ${o.code}`,
              hint: o.name,
            }))}
          />
        </div>

        <div className="relative mt-6 flex flex-col items-stretch gap-2 md:mt-10 md:flex-row md:items-center md:justify-start md:gap-3">
          {/* «Frame 1437254949» 1177:57333 — 342px, правое поле 210px (1177:57336) */}
          <AmountBox
            className="md:w-[342px] md:flex-none"
            label={t('targetLabel')}
            value={rate}
            onChange={(v) => setRate(v.replace(/[^\d\s.,]/g, '').slice(0, 10))}
            currency="KZT"
            invalid={showErrors && !rateValid}
          />
          {/* мобильный фрейм 2003:125276 — 36×36 r20 на surf2 с двумя тенями,
              с 768px остаётся голая иконка «reverse» 20×20 */}
          <span className="absolute left-1/2 top-1/2 z-10 flex h-9 w-9 shrink-0 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[20px] border border-stroke-modal bg-surface-page-surf2 text-text-default shadow-[0_1px_4px_rgb(12_12_13/0.05),0_1px_4px_rgb(12_12_13/0.1)] md:static md:mx-0 md:h-5 md:w-5 md:translate-x-0 md:translate-y-0 md:rounded-none md:border-0 md:bg-transparent md:shadow-none">
            <Icon name="sync_alt" size={20} />
          </span>
          <AmountBox
            className="md:w-[210px] md:flex-none"
            label={t('perOneLabel')}
            value="1"
            readOnly
            currency={foreign}
            currencyOptions={currencyOptions}
            onCurrencyChange={setForeign}
          />
        </div>

        {/* «Frame 1437254966» 1177:57339 — строка курса есть только с 768:
            мобильные фреймы 1774:158932/158747 её не содержат */}
        <div className="mt-3 hidden flex-wrap items-center gap-3 text-sm text-text-default md:flex">
          <span className="leading-[15.4px]">{`${t('currentRate')}:`}</span>
          {ratesQ.isPending ? (
            <span className="h-[23px] w-32 animate-pulse rounded-xl bg-surface-page-surf2" />
          ) : currentRate > 0 ? (
            /* «badge» 828:32967 — 4/12, r12, текст 14/15.4 цветом #878787 */
            <span className="rounded-xl bg-surface-page-surf2 px-3 py-1 leading-[15.4px] text-[#878787]">
              {formatNumber(currentRate, locale)} ₸ = 1 {currencySymbol(foreign)}
            </span>
          ) : (
            <span className="leading-[15.4px] text-text-disabled">
              {errorText('errors.RATES_NOT_FOUND')}
            </span>
          )}
        </div>
      </section>

      <section className="rounded-[22px] border border-stroke-surface1 bg-surface-page-surf1 p-4 md:rounded-[28px] md:p-8">
        <h2 className="text-lg font-medium leading-[1.2] text-text-default md:text-[32px]">
          {t('dateTitle')}
        </h2>
        {/* «Frame 1437255094» 1177:57575 — общая подпись группы 14/14 Inter
            Semi Bold, отступ 8 до селектов; сама группа «Frame 1437255102»
            с 768 идёт в строку с полем времени (зазор 24), ниже — колонкой (4) */}
        <div className="mt-6 md:mt-10">
          <p className="font-inter text-sm font-semibold leading-[14px] text-text-disabled">
            {`${t('notifyUntil')}:`}
          </p>
          <div className="mt-2 flex flex-col gap-1 md:flex-row md:items-center md:gap-6">
            {/* 1177:57578 — три селекта 132×66 в ряд с зазором 4, группа 404px.
                Подписи селектов скрыты визуально: над группой одна общая. */}
            <div className="grid grid-cols-3 gap-1 md:w-[404px] [&_[id$='-label']]:sr-only">
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
            {/* «Input time» 1207:70160 — 101×54, с 768 — 101×66 */}
            <div
              role="group"
              aria-label={t('notifyUntil')}
              className="flex h-[54px] w-[101px] shrink-0 items-center rounded-[20px] border border-surface-page-surf2 bg-surface-page-surf2 md:h-[66px]"
            >
              <input
                value={hh}
                onChange={(e) => setHh(e.target.value.replace(/\D/g, '').slice(0, 2))}
                inputMode="numeric"
                placeholder="23"
                className={clsx(TIME_CELL, 'pl-4 pr-2')}
              />
              <span aria-hidden className="text-base font-medium leading-5 text-text-default">
                :
              </span>
              <input
                value={mm}
                onChange={(e) => setMm(e.target.value.replace(/\D/g, '').slice(0, 2))}
                inputMode="numeric"
                placeholder="59"
                className={clsx(TIME_CELL, 'pl-2 pr-4')}
              />
            </div>
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

        <Button
          type="submit"
          className="mt-6 w-full md:mt-10 md:w-auto"
          disabled={create.isPending}
        >
          {t('cta')}
        </Button>
      </section>
    </form>
  );
}
