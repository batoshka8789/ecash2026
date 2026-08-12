'use client';

import { useId, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { CurrencyFlag } from '@/components/ui/CurrencyFlag';
import { Select, type SelectOption } from '@/components/ui/Select';
import { usePathname, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import {
  currencyFlagClass,
  currencyName,
  currencySymbol,
  formatMoney,
  formatNumber,
} from '@/lib/format';
import { sortCurrencyCodes } from '@/lib/currency-order';
import { useErrorText } from '@/lib/useErrorText';
import { useNearestDepId } from '@/lib/user-place';
import type { CurrencyCode } from '@/lib/domain';
import { RateGraph, RateGraphToggle, type Period } from './RateGraph';

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

/**
 * Калькулятор валюты на живых курсах + раскрывающаяся «Динамика курса».
 * initialCurrency — стартовая валюта пары: /locations открывается из строки
 * конкретной валюты («на карте» в списке курсов), и калькулятор там обязан
 * показать её, а не всегда USD.
 * syncCurrencyToUrl — смена валюты зеркалится в ?currency= (router.replace):
 * на /locations кнопки «Забронировать» у отделений (Branches) берут валюту
 * из URL — без синка после смены валюты в калькуляторе они бронировали бы
 * ту, с которой страница открылась, вразрез с тем, что показано сверху.
 */
export function Calculator({
  initialCurrency,
  syncCurrencyToUrl,
}: { initialCurrency?: string; syncCurrencyToUrl?: boolean } = {}) {
  const t = useTranslations('home.calculator');
  const tRates = useTranslations('rates');
  const tRoot = useTranslations();
  const locale = useLocale();
  const errorText = useErrorText();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const uid = useId();

  // uppercase на всякий случай: страница нормализует параметр, но проп
  // публичный — коды в API строго в верхнем регистре
  const normalizedInitial = initialCurrency?.toUpperCase();
  const [foreign, setForeign] = useState<CurrencyCode>(
    normalizedInitial && normalizedInitial !== 'KZT' ? normalizedInitial : 'USD',
  );
  const [direction, setDirection] = useState<Direction>('kztToForeign');
  /** Единственный источник суммы: какое поле ввёл пользователь и что именно. */
  const [entry, setEntry] = useState<{ source: Field; raw: string }>({ source: 'give', raw: '' });
  const [editing, setEditing] = useState<Field | null>(null);
  const [graphOpen, setGraphOpen] = useState(false);
  const [period, setPeriod] = useState<Period>('year');
  const graphId = useId();

  // Курсы — от БЛИЖАЙШЕГО к «Моему адресу» отделения (ключ общий с
  // RatesList: оба используют useNearestDepId — запрос дедуплицируется)
  const { depId } = useNearestDepId();
  const ratesQuery = useQuery({
    queryKey: ['rates', depId],
    enabled: depId != null,
    queryFn: ({ signal }) => api.rates.forDep(depId!, signal),
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
    // Порядок задаём сами: у апстрима он свой в каждом отделении, и золотые
    // слитки всплывали в начало списка сразу за тенге.
    return sortCurrencyCodes(['KZT' as CurrencyCode, ...codes]).map((code) => ({
      value: code,
      label: code,
      hint: currencyName(code, locale, goldLabel),
    }));
    // goldLabel пересоздаётся каждый рендер — зависимость через tRates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratesQuery.data, locale, tRates]);

  const stat = ratesQuery.data?.rates.find((r) => r.currencyCode === foreign);
  const rates = stat && stat.buy > 0 && stat.sell > 0 ? { buy: stat.buy, sell: stat.sell } : null;

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
    return formatMoney(value, locale);
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
    if (code !== 'KZT') {
      setForeign(code as CurrencyCode);
      // /locations: Branches читает валюту из URL для кнопок «Забронировать» —
      // держим её в согласии с тем, что реально выбрано в калькуляторе
      // (остальные параметры — ?view и т.п. — сохраняем)
      if (syncCurrencyToUrl) {
        const params = new URLSearchParams(searchParams);
        params.set('currency', code);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }
    }
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

  /**
   * Селектор валюты у поля. В макете это не отдельная кнопка внутри поля, а
   * правая ячейка самого поля: во всю его высоту, без скругления и рамки,
   * отделена от суммы вертикальной линией. Брендовая обводка появляется
   * ТОЛЬКО у раскрытого списка (aria-expanded) — раньше сторона валюты
   * носила её постоянно и читалась как поле в фокусе.
   *
   * Обводку рисуем inset-ring, а не border: бордер съел бы 1px внутренней
   * ширины ячейки и в момент открытия дёргал бы флаг с кодом. Правые углы
   * ячейки скруглены под поле (16 минус 1px рамки = 15), иначе обводка
   * срезала бы угол поля по квадрату.
   *
   * span:first-child (визуал «флаг + код») переводим во flex: у Select это
   * строчный контейнер, и вложенный inline-flex вставал по базовой линии —
   * флаг съезжал на 4px ниже центра ячейки.
   *
   * px-4 (а не px-3): места под флаг + код + птичку хватает и на мобильном,
   * потому что ячейка больше не отбита от края поля полями m-1/m-2.
   */
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
      arrow="chevron"
      searchPlaceholder={tRoot('flows.pair.searchCurrency')}
      noResultsText={tRoot('common.nothingFound')}
      // flex на самой ячейке, а высота кнопки — растяжкой, а не h-full:
      // до 1024 поля стоят колонкой, и `flex-1` на рамке поля управляет там
      // высотой, из-за чего высота становится «неопределённой» для процентов
      // и height:100% откатывается к auto (кнопка выходила 36px вместо 54)
      className="flex w-[136px] shrink-0 self-stretch border-l border-l-surface-page-surf1 min-[480px]:w-[140px] [&>button]:h-auto [&>button]:gap-1 [&>button]:rounded-none [&>button]:rounded-r-[15px] [&>button]:border-0 [&>button]:px-4 [&>button]:aria-expanded:inset-ring-1 [&>button]:aria-expanded:inset-ring-stroke-brand [&>button>span:first-child]:flex [&>button>span:first-child]:items-center sm:[&>div]:left-auto sm:[&>div]:right-0 sm:[&>div]:w-[290px] [&>span]:sr-only"
    />
  );

  return (
    <section className="container-page pt-6 sm:pt-8">
      <div className="rounded-2xl border border-stroke-surface1 bg-surface-page-surf1 p-5 sm:rounded-[28px] sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <h2 className="text-xl font-medium text-text-default sm:text-[32px]">{t('title')}</h2>
          <RateGraphToggle
            open={graphOpen}
            onToggle={() => setGraphOpen((v) => !v)}
            graphId={graphId}
            label={t('dynamics')}
          />
        </div>

        {/* график строится по конкретному отделению — ждём, пока оно
            определится по живому списку */}
        {graphOpen && depId != null && (
          <div id={graphId} className="anim-chart-panel overflow-hidden">
            <RateGraph depId={depId} code={foreign} period={period} setPeriod={setPeriod} />
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
            /* поля стоят колонкой до lg — кнопка чипом ложится на стык полей;
               с lg поля в ряд, и она превращается в голую иконку */
            className="absolute left-1/2 top-1/2 z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-stroke-modal bg-surface-page-surf2 text-text-default shadow-[0_1px_4px_rgb(12_12_13/0.05),0_1px_4px_rgb(12_12_13/0.1)] transition-colors hover:bg-comp-surface2-hover lg:static lg:mx-auto lg:h-10 lg:w-10 lg:translate-x-0 lg:translate-y-0 lg:rounded-full lg:border-0 lg:bg-transparent lg:shadow-none lg:hover:bg-comp-surface1-hover"
          >
            <motion.span
              animate={{ rotate: direction === 'foreignToKzt' ? 180 : 0 }}
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
              {/* «Курс сделки» + badge — из макета: fill surf1-alt, текст брендовым
                  цветом. Здесь показывается НАШ курс, по которому пройдёт обмен,
                  поэтому подпись именно «сделки», а не «на бирже». Официальный
                  курс НБ РК под калькулятором убран по требованию заказчика:
                  клиенту важна цена сделки, а не справочная котировка. */}
              <span className="flex items-center gap-2 text-xs text-text-disabled sm:gap-3 sm:text-sm">
                {t('exchangeRate')}
                <span className="rounded-xl bg-surface-page-surf1-alt px-3 py-1 font-medium text-text-brand">
                  {tRates('perUnit', {
                    rate: formatNumber(activeRate, locale, 2),
                    code: currencySymbol(foreign),
                  })}
                </span>
              </span>
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

/** Флаг валюты — «Currency» из макета: 40×32, r8, везде одинаково. */
function renderCurrencyFlag(opt: SelectOption) {
  const flag = opt.value.startsWith('GOLD') ? 'gold' : currencyFlagClass(opt.value);
  return flag ? (
    // !-префикс: у flag-icons есть свой .fi{width:1.333333em}, который по
    // порядку подключения CSS перебивает обычный w-10 той же специфичности
    <CurrencyFlag flag={flag} className="h-8 !w-10 shrink-0" />
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
    // border всегда (прозрачный в покое): фокус — брендовая обводка по радиусу поля,
    // единый рисунок фокуса всех текстовых полей сайта; заливка тоже
    // подсвечивается.
    // Фиксированная высота (56/66 из макета) — на ЭТОЙ рамке, а не на label:
    // у элемента без своей высоты border-box не гасит бордер, и пилюля росла
    // на 2px. Обводка — только от инпута суммы (has-[label>input:focus]):
    // focus-within ловил и поиск внутри селектора валюты.
    //
    // flex-1 включается только с 1024, где поля стоят в ряд и делят ширину.
    // До 1024 ряд — колонка, и flex-1 задавал бы полю не ширину, а ВЫСОТУ:
    // flex-basis 0% перебивает h-14/h-[66px], и высота молча уезжала к высоте
    // содержимого. По ширине поле и без flex-1 растягивается (align stretch).
    <div className="flex h-14 flex-none rounded-2xl border border-transparent bg-surface-page-surf2 transition-colors focus-within:bg-comp-surface2-hover has-[label>input:focus]:border-stroke-brand sm:h-[66px] lg:flex-1">
      {/*
        Высота поля фиксирована в обоих состояниях — подпись не сдвигает вёрстку.

        Растягиваем label ЧЕРЕЗ self-stretch, а не h-full. До 1024 ряд полей —
        колонка, и `flex-1` на рамке управляет там не шириной, а высотой:
        высота рамки становится «неопределённой» для процентов, `h-full`
        (height:100%) откатывается к auto и даёт высоту строки 24px. Центрировать
        внутри 24px нечего — плейсхолдер прилипал к верху поля, хотя селектор
        валюты рядом стоял по центру. self-stretch не зависит от определённости
        высоты родителя и заполняет рамку на любой ширине.
      */}
      <label
        htmlFor={id}
        className={clsx(
          'flex min-w-0 flex-1 cursor-text flex-col justify-center self-stretch px-4 sm:px-5',
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

