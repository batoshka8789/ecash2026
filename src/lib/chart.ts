/**
 * Геометрия графика «Динамика курса» (макет «Graph currency period»).
 *
 * Чистая функция, отделённая от компонента: в макете у графика 12 колонок
 * (Янв…Дек) и 5 подписей оси Y, а реальная история курса приходит с
 * произвольным числом точек (снапшоты каждые 15 мин + редкий upstream).
 * Линия строится по ВСЕМ точкам, а колонки/подписи — по выборке реальных
 * точек, поэтому маркер всегда лежит ровно на линии.
 *
 * Координаты — проценты (0…100): SVG рисуется в viewBox 0 0 100 100 с
 * preserveAspectRatio="none", а сетка, маркеры и подписи позиционируются
 * теми же процентами обычным CSS.
 */

import type { TickGranularity } from './format';

/** В макете 12 колонок графика и 5 подписей оси Y. */
export const MAX_COLUMNS = 12;
export const Y_TICKS = 5;

const DAY = 86_400_000;

/**
 * Гранулярность подписей оси X по ФАКТИЧЕСКОМУ размаху данных, а не по
 * номиналу периода. Своя история курса накоплена всего за несколько дней,
 * поэтому на «Годе» ось месяцев дала бы двенадцать одинаковых «июль» —
 * честнее показать реальные даты.
 */
export function tickGranularity(spanMs: number): TickGranularity {
  if (spanMs <= 2 * DAY) return 'time';
  if (spanMs <= 70 * DAY) return 'date';
  return 'month';
}

export type RawPoint = { t: string; buy: number; sell: number };

export type ChartColumn = {
  /** метка времени точки, мс */
  ms: number;
  buy: number;
  sell: number;
  /** позиция по X, % */
  fx: number;
  /** позиция по Y, % (0 — верх поля графика) */
  fy: number;
};

export type Chart = {
  /** путь SVG в процентных координатах */
  path: string;
  columns: ChartColumn[];
  /** 5 значений оси Y сверху вниз */
  yTicks: number[];
  /** минимум и максимум ряда (для текстовой альтернативы) */
  lo: number;
  hi: number;
  /** сколько реальных точек легло в линию */
  total: number;
  /** фактический размах ряда по времени, мс */
  spanMs: number;
};

/**
 * Строит геометрию графика по курсу продажи.
 * Возвращает null, если точек меньше двух — линию провести нельзя, и UI
 * показывает честное «данных пока недостаточно» вместо выдуманной кривой.
 */
export function buildChart(points: readonly RawPoint[] | undefined | null): Chart | null {
  const raw = (points ?? [])
    .map((p) => ({ ms: Date.parse(p.t), buy: p.buy, sell: p.sell }))
    .filter((p) => Number.isFinite(p.ms) && Number.isFinite(p.sell))
    .sort((a, b) => a.ms - b.ms);
  if (raw.length < 2) return null;

  const t0 = raw[0].ms;
  const span = raw[raw.length - 1].ms - t0 || 1;
  const values = raw.map((p) => p.sell);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  // запас по вертикали, чтобы линия не липла к краям;
  // плоский ряд (частый случай на реальных данных) получает свой размах
  const pad = (hi - lo) * 0.18 || Math.max(hi * 0.002, 0.5);
  const top = hi + pad;
  const height = top - (lo - pad);

  const fx = (ms: number) => ((ms - t0) / span) * 100;
  const fy = (v: number) => ((top - v) / height) * 100;

  const path = raw
    .map((p, i) => `${i ? 'L' : 'M'}${fx(p.ms).toFixed(3)},${fy(p.sell).toFixed(3)}`)
    .join(' ');

  const count = Math.min(MAX_COLUMNS, raw.length);
  const taken = new Set<number>();
  const columns: ChartColumn[] = [];
  for (let k = 0; k < count; k += 1) {
    const i = Math.round((k * (raw.length - 1)) / Math.max(1, count - 1));
    if (taken.has(i)) continue;
    taken.add(i);
    columns.push({ ...raw[i], fx: fx(raw[i].ms), fy: fy(raw[i].sell) });
  }

  const yTicks = Array.from({ length: Y_TICKS }, (_, i) => top - (height * i) / (Y_TICKS - 1));
  return {
    path,
    columns,
    yTicks,
    lo,
    hi,
    total: raw.length,
    spanMs: raw[raw.length - 1].ms - t0,
  };
}
