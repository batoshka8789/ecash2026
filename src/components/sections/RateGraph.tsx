'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/ui/Icon';
import { api } from '@/lib/api';
import { COLUMNS_BY_PERIOD, COLUMN_GAP, MAX_COLUMNS, buildChart, tickGranularity } from '@/lib/chart';
import {
  formatAxisTick,
  formatNumber,
  formatPointStamp,
  intlLocale,
  type TickGranularity,
} from '@/lib/format';
import { useErrorText } from '@/lib/useErrorText';
import type { CurrencyCode } from '@/lib/domain';

/** Порядок табов «Multitab» из макета. */
export const periods = ['year', 'month', 'week', 'day'] as const;
export type Period = (typeof periods)[number];

/**
 * Подписи оси Y графика — в макете всегда с двумя знаками («488.50»),
 * а formatNumber хвостовой ноль отбрасывает.
 */
function formatAxisValue(value: number, locale: string): string {
  return value.toLocaleString(intlLocale(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * «Динамика курса»: живая история по периодам, SVG-график по курсу продажи.
 * Общий для калькулятора на главной (Calculator.tsx) и брони (BookingFlow.tsx) —
 * в обоих экранах Figma использует один и тот же компонент, различие только
 * в кнопке-переключателе снаружи.
 */
export function RateGraph({
  depId,
  code,
  period,
  setPeriod,
}: {
  depId: number;
  code: CurrencyCode;
  period: Period;
  setPeriod: (p: Period) => void;
}) {
  const t = useTranslations('home.calculator');
  const tHome = useTranslations('home');
  const tRates = useTranslations('rates');
  const tRoot = useTranslations();
  const locale = useLocale();
  const errorText = useErrorText();
  const [hover, setHover] = useState<number | null>(null);

  // компонент смонтирован только при раскрытой «Динамике» — запрос лениво
  const historyQuery = useQuery({
    queryKey: ['rateHistory', depId, code, period],
    queryFn: ({ signal }) => api.rates.history({ depId, code, period }, signal),
    placeholderData: keepPreviousData,
  });

  const points = historyQuery.data?.points;
  const current = historyQuery.data?.current ?? null;

  // число колонок задаёт период: год 12, месяц 16, неделя и сутки по 7
  const chart = useMemo(
    () => buildChart(points, COLUMNS_BY_PERIOD[period] ?? MAX_COLUMNS),
    [points, period],
  );

  /**
   * Подписи оси по фактическому размаху ряда (макет рисует Янв…Дек, но своя
   * история короче года). Повтор соседней подписи гасим — иначе на коротком
   * ряде ось превращается в «июль июль июль…»; место колонки при этом
   * сохраняется, чтобы подписи стояли ровно под своими колонками.
   */
  const granularity: TickGranularity = chart ? tickGranularity(chart.spanMs) : 'date';
  const xLabels = useMemo(() => {
    if (!chart) return [];
    let prev = '';
    return chart.columns.map((c) => {
      // в макете месяц сокращён с прописной и без точки («Янв»), а Intl в ru
      // даёт «янв.» — берём словарь home.months
      const label =
        granularity === 'month'
          ? tHome(`months.${new Date(c.ms).getMonth()}`)
          : formatAxisTick(c.ms, locale, granularity);
      if (label === prev) return '';
      prev = label;
      return label;
    });
    // tHome пересоздаётся каждый рендер — зависимость через locale
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart, locale, granularity]);
  const filledLabels = xLabels.filter(Boolean).length;

  /**
   * Крайние точки в макете отступают от краёв поля на полколонки
   * («grapg item» 82.83 при поле 1038 — центр первой точки на 41.4).
   * Линия занимает ровно диапазон между центрами крайних колонок.
   */
  const colCount = chart?.columns.length ?? 0;
  const edgeInset = `calc((100% - ${(colCount - 1) * COLUMN_GAP}px) / ${colCount * 2})`;

  /** Текстовое описание изменения курса — в подписи таблицы для скринридера. */
  const changeText = (): string => {
    if (!current) return '';
    const value = formatNumber(Math.abs(current.change), locale, 2);
    if (current.change > 0) return tRates('chart.changeUp', { value });
    if (current.change < 0) return tRates('chart.changeDown', { value });
    return tRates('chart.changeFlat');
  };

  /** Колонка под курсором — подсказка со значением и датой. */
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!chart) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const i = Math.floor(((e.clientX - rect.left) / rect.width) * colCount);
    setHover(Math.min(colCount - 1, Math.max(0, i)));
  };

  return (
    <div className="mt-6 lg:mt-10">
      {/* «Multitab»: пилюли 25px с отступом 20 слева, как в макете */}
      <div role="group" aria-label={tRates('chart.group')} className="flex flex-wrap gap-1 pl-5">
        {periods.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={p === period}
            onClick={() => setPeriod(p)}
            className={clsx(
              'h-[25px] cursor-pointer rounded-full border px-3 text-sm leading-[1.1] transition-colors',
              p === period
                ? 'border-stroke-brand bg-btn-brand text-text-always-white'
                : 'border-stroke-surface1 bg-surface-page-surf1-alt text-text-default hover:bg-comp-surface2-hover',
            )}
          >
            {t(`periods.${p}`)}
          </button>
        ))}
      </div>

      {/* «Graph»: r24 на surf2, паддинги 20 со всех сторон */}
      <div className="relative mt-1 rounded-3xl bg-surface-page-surf2 p-5">
        {historyQuery.isPending ? (
          <div role="status" className="h-[160px] sm:h-[255px]">
            <span className="sr-only">{tRoot('system.loading')}</span>
            <div
              aria-hidden
              className="h-full rounded-xl bg-surface-modal-surf1 motion-safe:animate-pulse"
            />
          </div>
        ) : historyQuery.isError ? (
          <div
            role="alert"
            className="flex h-[160px] flex-col items-center justify-center gap-3 text-center sm:h-[255px]"
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
          <p className="flex h-[160px] items-center justify-center text-center text-sm text-text-disabled sm:h-[255px] sm:text-base">
            {tRates('noHistory')}
          </p>
        ) : (
          <div
            className={clsx(
              'flex gap-1 transition-opacity',
              historyQuery.isPlaceholderData && 'opacity-60',
            )}
          >
            {/* «Frame 4» — 5 подписей оси Y брендовым цветом, всегда два знака */}
            <div
              aria-hidden
              className="flex shrink-0 flex-col justify-between pb-8 pr-2 text-right text-sm leading-[1.1] text-text-brand"
            >
              {chart.yTicks.map((v, i) => (
                <span key={i}>{formatAxisValue(v, locale)}</span>
              ))}
            </div>

            <div className="min-w-0 flex-1">
              <div
                aria-hidden
                className="relative h-[120px] sm:h-[215px]"
                onPointerMove={onPointerMove}
                onPointerLeave={() => setHover(null)}
              >
                {/* линия курса — от центра первой колонки до центра последней;
                    у svg свои пропорции, поэтому рамку задаёт обёртка */}
                <div className="absolute inset-y-0" style={{ left: edgeInset, right: edgeInset }}>
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="h-full w-full overflow-visible"
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
                </div>

                {/* «grapg item» из макета: колонки равной ширины с зазором 4,
                    линия сетки и маркер 8px — по центру своей колонки */}
                <div className="absolute inset-0 flex gap-1">
                  {chart.columns.map((c, i) => (
                    <div key={`col-${c.ms}`} className="relative flex-1">
                      <span
                        className={clsx(
                          'absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors',
                          i === hover ? 'bg-brand-soft' : 'bg-brand-hardsoft',
                        )}
                      />
                      <span
                        className={clsx(
                          // маркер в макете светлее линии: palette/brand/60
                          'anim-chart-dot absolute left-1/2 rounded-full bg-[#FF7332]',
                          i === hover ? 'h-3 w-3' : 'h-2 w-2',
                        )}
                        style={
                          {
                            top: `${c.fy}%`,
                            '--anim-delay': `${0.35 + i * 0.04}s`,
                          } as React.CSSProperties
                        }
                      />

                      {/* читалка значения под курсором; уводится от краёв поля */}
                      {i === hover && (
                        <span
                          className={clsx(
                            'pointer-events-none absolute z-10 whitespace-nowrap rounded-xl bg-surface-modal-surf1 px-2 py-1 text-xs leading-4 text-text-default shadow-xl',
                            // у верхнего края подсказка уходит под точку, иначе — над ней
                            c.fy < 40 ? 'translate-y-3' : 'translate-y-[calc(-100%-12px)]',
                            i === 0
                              ? 'left-0'
                              : i === colCount - 1
                                ? 'right-0'
                                : 'left-1/2 -translate-x-1/2',
                          )}
                          style={{ top: `${c.fy}%` }}
                        >
                          <span className="font-medium">{formatNumber(c.sell, locale, 2)}</span>
                          <span className="ml-1.5 text-text-disabled">
                            {formatPointStamp(c.ms, locale, granularity)}
                          </span>
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* «big badge» — процент изменения в правом верхнем углу поля графика */}
                {current !== null && (
                  <span
                    className={clsx(
                      'absolute right-0 top-0 inline-flex items-center gap-1.5 rounded-xl px-2 py-0.5 text-sm font-medium leading-[18px]',
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
              </div>

              {/* подписи оси X — по одной на колонку (16 при интерлиньяже 1.3);
                  на узких экранах в макете показана каждая вторая */}
              <div
                aria-hidden
                className="mt-6 flex h-4 gap-1 text-xs font-medium leading-[1.3] text-text-brand"
              >
                {xLabels.map((label, i) => (
                  <span key={`tick-${i}`} className="min-w-0 flex-1 text-center">
                    <span
                      className={clsx(
                        'whitespace-nowrap',
                        filledLabels > 6 && i % 2 === 1 && 'hidden sm:inline',
                      )}
                    >
                      {label}
                    </span>
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

/**
 * Кнопка-переключатель «Динамика курса» — «a-button-main» secondary из
 * макета: обводка surf3, подпись обычным цветом, брендовые только иконка
 * и стрелка. Общая для калькулятора и брони — один и тот же компонент
 * Figma в обоих местах, различается только то, что раскрывается снизу.
 */
export function RateGraphToggle({
  open,
  onToggle,
  graphId,
  label,
}: {
  open: boolean;
  onToggle: () => void;
  graphId?: string;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={open ? graphId : undefined}
      onClick={onToggle}
      className="inline-flex h-[34px] w-fit cursor-pointer items-center gap-2 rounded-[20px] border border-divider-elevated px-3 text-sm leading-5 text-text-default transition-colors hover:bg-comp-surface1-hover min-[480px]:h-[46px] min-[480px]:px-4"
    >
      <Icon
        name={open ? 'visibility' : 'visibility_off'}
        size={16}
        className="text-text-brand min-[480px]:text-[20px]!"
      />
      <span className="text-xs font-medium leading-[1.2] min-[480px]:text-sm min-[480px]:leading-5">
        {label}
      </span>
      <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="flex">
        <Icon name="arrow_drop_down" size={12} className="text-text-brand" />
      </motion.span>
    </button>
  );
}
