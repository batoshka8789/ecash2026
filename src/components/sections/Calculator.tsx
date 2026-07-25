'use client';

import { useId, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { CurrencyFlag } from '@/components/ui/CurrencyFlag';
import { Select, type SelectOption } from '@/components/ui/Select';
import { useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { buildChart, tickGranularity } from '@/lib/chart';
import {
  currencyFlagClass,
  currencyName,
  currencySymbol,
  formatAxisTick,
  formatNumber,
  formatPointStamp,
  type TickGranularity,
} from '@/lib/format';
import { useErrorText } from '@/lib/useErrorText';
import type { CurrencyCode } from '@/lib/domain';

const DEP_ID = 1;
/** Общий ключ с RatesList — TanStack Query дедуплицирует запрос. */
const ratesQueryKey = ['rates', DEP_ID] as const;

/** Порядок табов «Multitab» из макета. */
const periods = ['year', 'month', 'week', 'day'] as const;
type Period = (typeof periods)[number];

/** kztToForeign: отдаю тенге, получаю валюту; foreignToKzt — наоборот. */
type Direction = 'kztToForeign' | 'foreignToKzt';
type Field = 'give' | 'get';

const MAX_DIGITS = 12;

/** Цифры, пробелы и одна десятичная запятая/точка; максимум 12 цифр. */
function sanitizeAmount(input: string): string {
  let out = '';
  let hasSeparator = false;
  let digits = 0;
  for (const ch of input) {
    if (ch >= '0' && ch <= '9') {
      if (digits >= MAX_DIGITS) continue;
      digits += 1;
      out += ch;
    } else if (ch === ',' || ch === '.') {
      if (hasSeparator) continue;
      hasSeparator = true;
      out += ch;
    } else if (/\s/.test(ch)) {
      out += ch;
    }
  }
  return out;
}

/** Разбор пользовательского ввода (после sanitizeAmount — максимум один разделитель). */
function parseAmount(raw: string): number {
  const n = parseFloat(raw.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

/** Число в «редактируемом» виде без групп разрядов: 1234,56 (en — с точкой). */
function plainAmount(n: number, locale: string): string {
  if (!Number.isFinite(n)) return '';
  const fixed = (Math.round(n * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
  return locale === 'en' ? fixed : fixed.replace('.', ',');
}

/** Калькулятор валюты на живых курсах + раскрывающаяся «Динамика курса». */
export function Calculator() {
  const t = useTranslations('home.calculator');
  const tRates = useTranslations('rates');
  const tRoot = useTranslations();
  const locale = useLocale();
  const errorText = useErrorText();
  const router = useRouter();
  const uid = useId();

  const [foreign, setForeign] = useState<CurrencyCode>('USD');
  const [direction, setDirection] = useState<Direction>('kztToForeign');
  /** Единственный источник суммы: какое поле ввёл пользователь и что именно. */
  const [entry, setEntry] = useState<{ source: Field; raw: string }>({ source: 'give', raw: '' });
  const [editing, setEditing] = useState<Field | null>(null);
  const [graphOpen, setGraphOpen] = useState(false);
  const [period, setPeriod] = useState<Period>('year');
  const graphId = useId();

  const ratesQuery = useQuery({
    queryKey: ratesQueryKey,
    queryFn: ({ signal }) => api.rates.forDep(DEP_ID, signal),
  });

  const goldLabel = (grams: string) => tRates('gold', { grams });

  /**
   * Список валют для обоих селекторов. В макете KZT — полноправная строка
   * дропдауна: выбор тенге на «валютной» стороне переворачивает направление.
   */
  const options = useMemo<SelectOption[]>(() => {
    const codes = (ratesQuery.data?.rates ?? [])
      .map((r) => r.currencyCode)
      .filter((c) => c !== 'KZT');
    return ['KZT' as CurrencyCode, ...codes].map((code) => ({
      value: code,
      label: code,
      hint: currencyName(code, locale, goldLabel),
    }));
    // goldLabel пересоздаётся каждый рендер — зависимость через tRates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratesQuery.data, locale, tRates]);

  const stat = ratesQuery.data?.rates.find((r) => r.currencyCode === foreign);
  const rates = stat && stat.buy > 0 && stat.sell > 0 ? { buy: stat.buy, sell: stat.sell } : null;
  /** «Курс на бирже» НБ РК по выбранной валюте (золота в фиде нет — null). */
  const marketRate = ratesQuery.data?.marketRates?.[foreign] ?? null;

  /**
   * Правило направления: отдаю тенге → покупаю валюту по курсу ПРОДАЖИ
   * обменника; отдаю валюту → получаю тенге по курсу ПОКУПКИ.
   */
  const convert = (value: number, from: Field): number | null => {
    if (!rates) return null;
    if (direction === 'kztToForeign') {
      return from === 'give' ? value / rates.sell : value * rates.sell;
    }
    return from === 'give' ? value * rates.buy : value / rates.buy;
  };

  const activeRate = rates ? (direction === 'kztToForeign' ? rates.sell : rates.buy) : null;
  const anchorValue = parseAmount(entry.raw);

  const fieldValue = (field: Field): number | null => {
    if (!Number.isFinite(anchorValue)) return null;
    return field === entry.source ? anchorValue : convert(anchorValue, entry.source);
  };

  const display = (field: Field): string => {
    if (field === entry.source && editing === field) return entry.raw;
    const value = fieldValue(field);
    if (value === null) return field === entry.source ? entry.raw : '';
    return formatNumber(value, locale, 2);
  };

  const onFieldChange = (field: Field, value: string) =>
    setEntry({ source: field, raw: sanitizeAmount(value) });

  /** При фокусе поле становится источником и показывает число без групп разрядов. */
  const onFieldFocus = (field: Field) => {
    setEditing(field);
    const value = fieldValue(field);
    setEntry((prev) =>
      field === prev.source && value === null
        ? prev
        : { source: field, raw: value !== null ? plainAmount(value, locale) : '' },
    );
  };

  /** Суммы остаются при своих валютах: меняется только чьё поле «источник». */
  const flip = () => {
    setEntry((prev) => ({ source: prev.source === 'give' ? 'get' : 'give', raw: prev.raw }));
    setEditing(null);
  };

  // направление меняется, суммы остаются при своих валютах, курс пересчитывается
  const onSwap = () => {
    setDirection((d) => (d === 'kztToForeign' ? 'foreignToKzt' : 'kztToForeign'));
    flip();
  };

  const giveCode: CurrencyCode = direction === 'kztToForeign' ? 'KZT' : foreign;
  const getCode: CurrencyCode = direction === 'kztToForeign' ? foreign : 'KZT';

  /**
   * Выбор валюты в любом из двух селекторов. Калькулятор всегда считает
   * пару KZT↔валюта, поэтому выбор задаёт и валюту, и направление; если
   * направление перевернулось — суммы остаются при своих валютах.
   */
  const onPickCurrency = (field: Field, code: string) => {
    const current = field === 'give' ? giveCode : getCode;
    if (code === current) return;
    const nextDirection: Direction =
      code === 'KZT'
        ? field === 'give'
          ? 'kztToForeign'
          : 'foreignToKzt'
        : field === 'give'
          ? 'foreignToKzt'
          : 'kztToForeign';
    if (code !== 'KZT') setForeign(code as CurrencyCode);
    if (nextDirection !== direction) {
      setDirection(nextDirection);
      flip();
    }
  };

  const goBooking = () => {
    const params = new URLSearchParams({ from: giveCode, to: getCode });
    const giveValue = fieldValue('give');
    if (giveValue !== null && giveValue > 0) {
      params.set('amount', String(Math.round(giveValue * 100) / 100));
    }
    router.push(`/booking?${params.toString()}`);
  };

  /** Селектор валюты у поля — в макете обе стороны со стрелкой-дропдауном. */
  const currencySelect = (field: Field, code: CurrencyCode) => (
    <Select
      value={code}
      options={options}
      onChange={(next) => onPickCurrency(field, next)}
      label={`${field === 'give' ? t('give') : t('get')} — ${tRates('currency')}`}
      placeholder={code}
      renderValue={renderCurrencyOption}
      renderLeading={renderCurrencyFlag}
      searchable
      searchPlaceholder={tRoot('flows.pair.searchCurrency')}
      noResultsText={tRoot('common.nothingFound')}
      className="m-1 w-32 shrink-0 self-center sm:m-2 sm:w-40 [&>div]:left-auto [&>div]:right-0 [&>div]:w-[290px] [&>span]:sr-only"
    />
  );

  return (
    <section className="container-page pt-6 sm:pt-8">
      <div className="rounded-2xl border border-stroke-surface1 bg-surface-page-surf1 p-5 sm:rounded-[28px] sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <h2 className="text-xl font-medium text-text-default sm:text-[32px]">{t('title')}</h2>
          <button
            type="button"
            aria-expanded={graphOpen}
            aria-controls={graphOpen ? graphId : undefined}
            onClick={() => setGraphOpen((v) => !v)}
            className="inline-flex h-10 w-fit cursor-pointer items-center gap-2 rounded-2xl border border-stroke-surface2 px-3 text-sm text-text-default transition-colors hover:bg-comp-surface1-hover sm:h-11 sm:px-4"
          >
            <Icon name={graphOpen ? 'visibility' : 'visibility_off'} size={20} />
            {t('dynamics')}
            <motion.span animate={{ rotate: graphOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <Icon name="keyboard_arrow_down" size={20} />
            </motion.span>
          </button>
        </div>

        {graphOpen && (
          <div id={graphId} className="anim-chart-panel overflow-hidden">
            <Graph code={foreign} period={period} setPeriod={setPeriod} />
          </div>
        )}

        <div className="relative mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
          <AmountField
            id={`${uid}-give`}
            label={`${t('give')} (${currencySymbol(giveCode)})`}
            value={display('give')}
            onChange={(v) => onFieldChange('give', v)}
            onFocus={() => onFieldFocus('give')}
            onBlur={() => setEditing(null)}
            control={currencySelect('give', giveCode)}
          />
          <button
            type="button"
            onClick={onSwap}
            aria-label={t('swap')}
            className="mx-auto inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-text-default transition-colors hover:bg-comp-surface1-hover"
          >
            <motion.span
              animate={{ rotate: direction === 'foreignToKzt' ? 180 : 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="flex"
            >
              <Icon name="swap_vert" size={22} className="lg:hidden" />
              <Icon name="sync_alt" size={22} className="hidden lg:inline" />
            </motion.span>
          </button>
          <AmountField
            id={`${uid}-get`}
            label={`${t('get')} (${currencySymbol(getCode)})`}
            value={display('get')}
            onChange={(v) => onFieldChange('get', v)}
            onFocus={() => onFieldFocus('get')}
            onBlur={() => setEditing(null)}
            control={currencySelect('get', getCode)}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 sm:mt-6 sm:gap-4">
          {ratesQuery.isPending && (
            <span
              role="status"
              aria-label={tRoot('system.loading')}
              className="h-8 w-40 rounded-full bg-surface-page-surf2 motion-safe:animate-pulse"
            />
          )}
          {ratesQuery.isError && (
            <span role="alert" className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-text-negative">
                {errorText(
                  ratesQuery.error instanceof Error ? ratesQuery.error.message : undefined,
                )}
              </span>
              <button
                type="button"
                onClick={() => ratesQuery.refetch()}
                className="cursor-pointer font-medium text-text-brand underline-offset-2 hover:underline"
              >
                {tRoot('branches.retry')}
              </button>
            </span>
          )}
          {activeRate !== null && (
            <>
              <span className="rounded-full bg-brand-hardsoft px-3 py-1.5 text-sm font-medium text-text-brand">
                {tRates('perUnit', {
                  rate: formatNumber(activeRate, locale, 2),
                  code: currencySymbol(foreign),
                })}
              </span>
              {marketRate !== null && (
                <span className="text-xs text-text-disabled sm:text-sm">
                  {tRates('marketSource')}:{' '}
                  {tRates('perUnit', {
                    rate: formatNumber(marketRate, locale, 2),
                    code: currencySymbol(foreign),
                  })}
                </span>
              )}
            </>
          )}
          <Button className="w-full sm:ml-auto sm:w-auto sm:min-w-44" onClick={goBooking}>
            {t('book')}
          </Button>
        </div>
      </div>
    </section>
  );
}

/** Флаг валюты 40×32 — «Currency» из макета (в строке списка стоит слева). */
function renderCurrencyFlag(opt: SelectOption) {
  const flag = opt.value.startsWith('GOLD') ? 'gold' : currencyFlagClass(opt.value);
  return flag ? (
    <CurrencyFlag flag={flag} className="h-8 w-10 shrink-0" />
  ) : (
    <span
      aria-hidden
      className="flex h-8 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-modal-surf1 text-[10px] font-bold text-text-disabled"
    >
      {opt.value.slice(0, 3)}
    </span>
  );
}

/** Значение в закрытом селекте: флаг + код. */
function renderCurrencyOption(opt: SelectOption) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      {renderCurrencyFlag(opt)}
      <span className="truncate font-medium">{opt.value}</span>
    </span>
  );
}

/** Поле суммы с «плавающей» подписью: пустое — плейсхолдер, заполненное — label сверху. */
function AmountField({
  id,
  label,
  value,
  onChange,
  onFocus,
  onBlur,
  control,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  control: React.ReactNode;
}) {
  const filled = value !== '';
  return (
    <div className="flex flex-1 rounded-2xl bg-surface-page-surf2 transition-colors focus-within:bg-comp-surface2-hover">
      {/* высота поля фиксирована в обоих состояниях — подпись не сдвигает вёрстку */}
      <label
        htmlFor={id}
        className={clsx(
          'flex h-14 min-w-0 flex-1 cursor-text flex-col justify-center px-4 sm:h-[66px] sm:px-5',
          filled && 'gap-1',
        )}
      >
        <span
          className={clsx('truncate text-text-disabled', filled ? 'text-xs font-bold' : 'sr-only')}
        >
          {label}
        </span>
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={label}
          inputMode="decimal"
          autoComplete="off"
          className="w-full min-w-0 bg-transparent text-base font-medium text-text-default outline-none placeholder:font-medium placeholder:text-text-disabled"
        />
      </label>
      {control}
    </div>
  );
}

/** «Динамика курса»: живая история по периодам, SVG-график по курсу продажи. */
function Graph({
  code,
  period,
  setPeriod,
}: {
  code: CurrencyCode;
  period: Period;
  setPeriod: (p: Period) => void;
}) {
  const t = useTranslations('home.calculator');
  const tRates = useTranslations('rates');
  const tRoot = useTranslations();
  const locale = useLocale();
  const errorText = useErrorText();
  const [hover, setHover] = useState<number | null>(null);

  // компонент смонтирован только при раскрытой «Динамике» — запрос лениво
  const historyQuery = useQuery({
    queryKey: ['rateHistory', DEP_ID, code, period],
    queryFn: ({ signal }) => api.rates.history({ depId: DEP_ID, code, period }, signal),
    placeholderData: keepPreviousData,
  });

  const points = historyQuery.data?.points;
  const current = historyQuery.data?.current ?? null;

  const chart = useMemo(() => buildChart(points), [points]);

  /**
   * Подписи оси по фактическому размаху ряда (макет рисует Янв…Дек, но своя
   * история короче года). Повтор соседней подписи пропускаем — иначе на
   * коротком ряде ось превращается в «июль июль июль…».
   */
  const granularity: TickGranularity = chart ? tickGranularity(chart.spanMs) : 'date';
  const xTicks = useMemo(() => {
    if (!chart) return [];
    const out: { fx: number; label: string }[] = [];
    for (const c of chart.columns) {
      const label = formatAxisTick(c.ms, locale, granularity);
      if (out.length > 0 && out[out.length - 1].label === label) continue;
      out.push({ fx: c.fx, label });
    }
    return out;
  }, [chart, locale, granularity]);

  /** Текстовое описание изменения курса — в подписи таблицы для скринридера. */
  const changeText = (): string => {
    if (!current) return '';
    const value = formatNumber(Math.abs(current.change), locale, 2);
    if (current.change > 0) return tRates('chart.changeUp', { value });
    if (current.change < 0) return tRates('chart.changeDown', { value });
    return tRates('chart.changeFlat');
  };

  const hovered = hover !== null && chart ? (chart.columns[hover] ?? null) : null;

  /** Ближайшая колонка к позиции курсора — подсказка со значением и датой. */
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!chart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const frac = ((e.clientX - rect.left) / rect.width) * 100;
    let best = 0;
    for (let i = 1; i < chart.columns.length; i += 1) {
      if (Math.abs(chart.columns[i].fx - frac) < Math.abs(chart.columns[best].fx - frac)) best = i;
    }
    setHover(best);
  };

  return (
    <div className="mt-5 sm:mt-6">
      {/* «Multitab»: пилюли 26px с отступом 20 слева, как в макете */}
      <div role="group" aria-label={tRates('chart.group')} className="flex flex-wrap gap-1 pl-5">
        {periods.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={p === period}
            onClick={() => setPeriod(p)}
            className={clsx(
              'h-[26px] cursor-pointer rounded-full border px-3 text-sm leading-none transition-colors',
              p === period
                ? 'border-stroke-brand bg-btn-brand text-text-always-white'
                : 'border-stroke-surface1 bg-surface-page-surf1-alt text-text-default hover:bg-comp-surface2-hover',
            )}
          >
            {t(`periods.${p}`)}
          </button>
        ))}
      </div>

      {/* «Graph»: r24 на surf2, паддинги 12/8/8/12 → 20 с sm */}
      <div className="relative mt-1 rounded-3xl bg-surface-page-surf2 pb-2 pl-3 pr-2 pt-3 sm:p-5">
        {historyQuery.isPending ? (
          <div role="status" className="h-[183px] sm:h-[255px]">
            <span className="sr-only">{tRoot('system.loading')}</span>
            <div
              aria-hidden
              className="h-full rounded-xl bg-surface-modal-surf1 motion-safe:animate-pulse"
            />
          </div>
        ) : historyQuery.isError ? (
          <div
            role="alert"
            className="flex h-[183px] flex-col items-center justify-center gap-3 text-center sm:h-[255px]"
          >
            <p className="text-sm text-text-default sm:text-base">
              {errorText(
                historyQuery.error instanceof Error ? historyQuery.error.message : undefined,
              )}
            </p>
            <button
              type="button"
              onClick={() => historyQuery.refetch()}
              className="cursor-pointer text-sm font-medium text-text-brand underline-offset-2 hover:underline"
            >
              {tRoot('branches.retry')}
            </button>
          </div>
        ) : !chart ? (
          <p className="flex h-[183px] items-center justify-center text-center text-sm text-text-disabled sm:h-[255px] sm:text-base">
            {tRates('noHistory')}
          </p>
        ) : (
          <div
            className={clsx(
              'flex gap-1 transition-opacity',
              historyQuery.isPlaceholderData && 'opacity-60',
            )}
          >
            {/* «Frame 4» — 5 подписей оси Y брендовым цветом */}
            <div
              aria-hidden
              className="flex shrink-0 flex-col justify-between pb-5 pr-2 text-right text-xs leading-none text-text-brand sm:pb-8 sm:text-sm"
            >
              {chart.yTicks.map((v, i) => (
                <span key={i}>{formatNumber(v, locale, 2)}</span>
              ))}
            </div>

            <div className="min-w-0 flex-1">
              <div
                aria-hidden
                className="relative h-[151px] sm:h-[215px]"
                onPointerMove={onPointerMove}
                onPointerLeave={() => setHover(null)}
              >
                {/* вертикальная сетка по колонкам — brand 20% из токенов */}
                {chart.columns.map((c, i) => (
                  <span
                    key={`grid-${c.ms}`}
                    className={clsx(
                      'absolute bottom-0 top-0 w-px transition-colors',
                      i === hover ? 'bg-brand-soft' : 'bg-brand-hardsoft',
                    )}
                    style={{ left: `${c.fx}%` }}
                  />
                ))}

                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="absolute inset-0 h-full w-full overflow-visible"
                >
                  <path
                    key={`${code}-${period}`}
                    d={chart.path}
                    fill="none"
                    stroke="var(--color-brand)"
                    strokeWidth={1}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    className="anim-chart-path"
                  />
                </svg>

                {/* точки-маркеры 8px на реальных значениях */}
                {chart.columns.map((c, i) => (
                  <span
                    key={`dot-${c.ms}`}
                    className={clsx(
                      'anim-chart-dot absolute rounded-full bg-brand',
                      i === hover ? 'h-3 w-3' : 'h-2 w-2',
                    )}
                    style={
                      {
                        left: `${c.fx}%`,
                        top: `${c.fy}%`,
                        '--anim-delay': `${0.35 + i * 0.04}s`,
                      } as React.CSSProperties
                    }
                  />
                ))}

                {/* «big badge» — процент изменения в правом верхнем углу поля графика */}
                {current !== null && (
                  <span
                    className={clsx(
                      'absolute right-0 top-0 inline-flex items-center gap-1.5 rounded-xl px-2 py-0.5 text-xs font-bold',
                      current.change < 0
                        ? 'bg-negative-hardsoft text-text-negative'
                        : current.change > 0
                          ? 'bg-positive-hardsoft text-text-positive'
                          : 'bg-surface-modal-surf1 text-text-disabled',
                    )}
                  >
                    {current.change !== 0 && (
                      <Icon
                        name={current.change < 0 ? 'arrow_downward' : 'arrow_upward'}
                        size={12}
                      />
                    )}
                    {formatNumber(Math.abs(current.change), locale, 2)} %
                  </span>
                )}

                {/* читалка значения под курсором; уводится от краёв поля графика */}
                {hovered && (
                  <span
                    className={clsx(
                      'pointer-events-none absolute z-10 whitespace-nowrap rounded-xl bg-surface-modal-surf1 px-2 py-1 text-xs text-text-default shadow-xl',
                      // у верхнего края подсказка уходит под точку, иначе — над ней
                      hovered.fy < 40 ? 'translate-y-3' : 'translate-y-[calc(-100%-12px)]',
                      hovered.fx < 15
                        ? ''
                        : hovered.fx > 85
                          ? 'translate-x-[-100%]'
                          : 'translate-x-[-50%]',
                    )}
                    style={{ left: `${hovered.fx}%`, top: `${hovered.fy}%` }}
                  >
                    <span className="font-medium">{formatNumber(hovered.sell, locale, 2)}</span>
                    <span className="ml-1.5 text-text-disabled">
                      {formatPointStamp(hovered.ms, locale, granularity)}
                    </span>
                  </span>
                )}
              </div>

              {/* подписи оси X; на узких экранах в макете показана каждая вторая */}
              <div
                aria-hidden
                className="relative mt-3 h-4 text-xs font-medium leading-none text-text-brand sm:mt-6"
              >
                {xTicks.map((tick, i) => (
                  <span
                    key={`tick-${tick.fx}-${tick.label}`}
                    className={clsx(
                      'absolute top-0 -translate-x-1/2 whitespace-nowrap',
                      xTicks.length > 6 && i % 2 === 1 && 'hidden sm:inline',
                    )}
                    style={{ left: `${tick.fx}%` }}
                  >
                    {tick.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Текстовая альтернатива графика: та же выборка точек таблицей. */}
        {chart && (
          <table className="sr-only">
            <caption>
              {tRates('chart.caption', { code, period: t(`periods.${period}`) })}{' '}
              {tRates('chart.summary', {
                count: chart.total,
                min: formatNumber(chart.lo, locale, 2),
                max: formatNumber(chart.hi, locale, 2),
              })}{' '}
              {changeText()}
            </caption>
            <thead>
              <tr>
                <th scope="col">{tRates('chart.time')}</th>
                <th scope="col">{tRoot('home.rates.buy')}</th>
                <th scope="col">{tRoot('home.rates.sell')}</th>
              </tr>
            </thead>
            <tbody>
              {chart.columns.map((c) => (
                <tr key={`row-${c.ms}`}>
                  <th scope="row">{formatPointStamp(c.ms, locale, granularity)}</th>
                  <td>{formatNumber(c.buy, locale, 2)}</td>
                  <td>{formatNumber(c.sell, locale, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
