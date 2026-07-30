/**
 * Геометрия графика «Динамика курса» (макет «Graph currency period»).
 *
 * Чистая функция, отделённая от компонента: в макете поле графика — это
 * колонки равной ширины с зазором 4 («grapg item/desktop» 82.83×255 с шагом
 * 86.83), в каждой по вертикальной линии сетки, точке и подписи оси X.
 * Число колонок задаёт период: год 12, месяц 16, неделя и сутки по 7.
 *
 * Линия строится по ВСЕМ точкам истории (снапшоты приходят чаще, чем колонок),
 * а значение колонки берётся ЛИНЕЙНОЙ ИНТЕРПОЛЯЦИЕЙ ряда на её метку времени.
 * Метки времени колонок равномерны (t0 + k·span/(n−1)), поэтому колонки стоят
 * с равным шагом, как в макете, а маркер при этом лежит ровно на линии:
 * интерполяция идёт по тому же отрезку, что рисует path.
 *
 * Координаты — проценты (0…100): SVG рисуется в viewBox 0 0 100 100 с
 * preserveAspectRatio="none", а сетка, маркеры и подписи позиционируются
 * теми же процентами обычным CSS.
 */

import type { TickGranularity } from './format';

/** Колонок в периоде «год» из макета — оно же значение по умолчанию. */
export const MAX_COLUMNS = 12;

/**
 * Число колонок по периоду — из макета «Multi graph»: год 12 колонок
 * (1546:143209), месяц 16, неделя 7, сутки 7 (мастера 1531:116656/116803/116920).
 */
export const COLUMNS_BY_PERIOD: Record<string, number> = {
  year: MAX_COLUMNS,
  month: 16,
  week: 7,
  day: 7,
};

/** В макете 5 подписей оси Y. */
export const Y_TICKS = 5;

/** Зазор между колонками поля графика, px («Frame 1437255011» gap=4). */
export const COLUMN_GAP = 4;

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
  /** метка времени колонки, мс */
  ms: number;
  buy: number;
  sell: number;
  /** позиция по X, % (равный шаг: k/(n−1)) */
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
export function buildChart(
  points: readonly RawPoint[] | undefined | null,
  columns = MAX_COLUMNS,
): Chart | null {
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

  /** Значение ряда в произвольный момент — линейно между соседними точками. */
  const valueAt = (ms: number) => {
    let i = 1;
    while (i < raw.length - 1 && raw[i].ms < ms) i += 1;
    const a = raw[i - 1];
    const b = raw[i];
    const k = b.ms === a.ms ? 0 : (ms - a.ms) / (b.ms - a.ms);
    return { buy: a.buy + (b.buy - a.buy) * k, sell: a.sell + (b.sell - a.sell) * k };
  };

  // больше колонок, чем реальных точек, не рисуем — иначе график
  // «дорисовывает» историю, которой нет
  const count = Math.max(2, Math.min(columns, raw.length));
  const cols: ChartColumn[] = [];
  for (let k = 0; k < count; k += 1) {
    const ms = t0 + (span * k) / (count - 1);
    const v = valueAt(ms);
    cols.push({ ms, buy: v.buy, sell: v.sell, fx: (k / (count - 1)) * 100, fy: fy(v.sell) });
  }

  /*
   * Линия идёт по всем точкам истории, но вершины колонок в неё добавлены
   * явно: они лежат на тех же отрезках, форму не меняют, зато маркер колонки
   * гарантированно стоит на линии (та же пара координат, что и в path).
   */
  const vertices = [
    ...raw.map((p) => ({ ms: p.ms, fx: fx(p.ms), fy: fy(p.sell) })),
    ...cols.map((c) => ({ ms: c.ms, fx: c.fx, fy: c.fy })),
  ].sort((a, b) => a.ms - b.ms || a.fx - b.fx);
  const path = vertices
    .map((p, i) => `${i ? 'L' : 'M'}${p.fx.toFixed(3)},${p.fy.toFixed(3)}`)
    .join(' ');

  const yTicks = Array.from({ length: Y_TICKS }, (_, i) => top - (height * i) / (Y_TICKS - 1));
  return {
    path,
    columns: cols,
    yTicks,
    lo,
    hi,
    total: raw.length,
    spanMs: raw[raw.length - 1].ms - t0,
  };
}
