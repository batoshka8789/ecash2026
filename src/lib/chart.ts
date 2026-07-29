/**
 * Геометрия графика «Динамика курса» (макет «Graph currency period»).
 *
 * Чистая функция, отделённая от компонента. Реальная история курса приходит
 * с произвольным числом точек (снапшоты каждые 15 мин + редкий upstream),
 * поэтому вся сетка строится РЕГУЛЯРНО, а не по точкам ряда:
 *
 *   · ось X — равные интервалы времени, выровненные по локальным
 *     часам/суткам. Раньше вертикальная линия и подпись рисовались на каждой
 *     выбранной точке: точки идут неравномерно (ночью снапшотов нет, днём
 *     пачка), и линии сбивались в частокол, а подписи налезали друг на друга;
 *   · ось Y — «круглые» значения (506, 506.5, 507 …) вместо остатков от
 *     деления диапазона (508.01, 507.51 …);
 *   · маркеры — только когда точек мало; на длинном ряде остаются края и
 *     экстремумы, иначе линия превращается в цепочку слипшихся кружков.
 *
 * Координаты — проценты (0…100): SVG рисуется в viewBox 0 0 100 100 с
 * preserveAspectRatio="none", а сетка, маркеры и подписи позиционируются
 * теми же процентами обычным CSS.
 */

import type { TickGranularity } from './format';

/** Подписей на оси Y (в макете их 5). */
export const Y_TICKS = 5;
/** Столько подписей времени по оси X просим у генератора. */
export const X_TICKS = 6;
/** Выше этого числа точек кружки не рисуем — только края и экстремумы. */
export const MAX_MARKERS = 24;
/** Минимальный зазор между кружками, % ширины поля. */
export const MIN_MARKER_GAP = 3;
/** Строк в текстовой альтернативе графика. */
export const MAX_TABLE_ROWS = 12;

const MINUTE = 60_000;
const HOUR = 3_600_000;
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

export type ChartPoint = {
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
  /** путь линии в процентных координатах */
  path: string;
  /** тот же путь, замкнутый по низу поля — под градиентную заливку */
  areaPath: string;
  /** все точки ряда: по ним ищется ближайшая к курсору */
  points: ChartPoint[];
  /** точки, на которых рисуем кружки */
  markers: ChartPoint[];
  /** выборка для sr-таблицы */
  tableRows: ChartPoint[];
  /** равномерные отметки времени */
  xTicks: { ms: number; fx: number }[];
  /** «круглые» значения оси Y сверху вниз */
  yTicks: { value: number; fy: number }[];
  /** минимум и максимум ряда */
  lo: number;
  hi: number;
  /** сколько реальных точек легло в линию */
  total: number;
  /** фактический размах ряда по времени, мс */
  spanMs: number;
};

/** Ближайшее «круглое» число не меньше rough: 1 / 2 / 2.5 / 5 × 10ⁿ. */
function niceStep(rough: number): number {
  if (!(rough > 0)) return 1;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return step * mag;
}

/**
 * Шкала по «круглым» значениям: границы кратны шагу, поэтому подписи читаются
 * (506 / 506,5 / 507), а линии сетки совпадают с ними ровно.
 *
 * Плоский ряд (частый случай: курс не менялся сутки) размаха не имеет — берём
 * окрестность порядка 0.15 % от значения, иначе шкала схлопывается в точку.
 */
function niceScale(lo: number, hi: number, ticks: number) {
  const raw = hi - lo;
  const pad = raw > 0 ? raw * 0.15 : Math.max(Math.abs(hi) * 0.0015, 0.01);
  const step = niceStep((raw + 2 * pad) / (ticks - 1));
  const min = Math.floor((lo - pad) / step) * step;
  const max = min + step * (ticks - 1);
  // если ряд не поместился (округление вниз съело верх) — добавляем шаг
  return max >= hi ? { min, max, step } : { min, max: max + step, step };
}

/** Лестница шагов оси времени — от пяти минут до года. */
const TIME_STEPS = [
  5 * MINUTE,
  15 * MINUTE,
  30 * MINUTE,
  HOUR,
  2 * HOUR,
  3 * HOUR,
  6 * HOUR,
  12 * HOUR,
  DAY,
  2 * DAY,
  7 * DAY,
  14 * DAY,
  30 * DAY,
  60 * DAY,
  90 * DAY,
  180 * DAY,
  365 * DAY,
];

/**
 * Отметки времени с равным шагом, выровненные по локальной сетке: шаг меньше
 * суток встаёт на круглые часы, шаг от суток — на локальную полночь. Без
 * поправки на часовой пояс отметки «каждые 6 часов» показывали 05:00 и 11:00.
 */
export function timeTicks(t0: number, t1: number, target = X_TICKS): number[] {
  const span = Math.max(1, t1 - t0);
  const step = TIME_STEPS.find((s) => span / s <= target - 1) ?? TIME_STEPS[TIME_STEPS.length - 1];
  const offset = new Date(t0).getTimezoneOffset() * MINUTE;
  const out: number[] = [];
  for (let ms = Math.ceil((t0 - offset) / step) * step + offset; ms <= t1; ms += step) {
    out.push(ms);
  }
  // очень короткий ряд может не поймать ни одной отметки — показываем края
  if (out.length === 0) return [t0, t1];
  return out;
}

/**
 * Прореживание по РАССТОЯНИЮ, а не по номеру: снапшоты идут неравномерно
 * (ночью пусто, днём пачка), и кружки слипались в сплошную полосу именно там,
 * где точек много. Последняя точка сохраняется всегда — это «сейчас».
 */
function thinByGap(points: readonly ChartPoint[], minGap: number): ChartPoint[] {
  if (points.length === 0) return [];
  const out: ChartPoint[] = [points[0]];
  for (const p of points.slice(1)) {
    if (p.fx - out[out.length - 1].fx >= minGap) out.push(p);
  }
  const last = points[points.length - 1];
  if (out[out.length - 1] !== last) {
    if (out.length > 1 && last.fx - out[out.length - 1].fx < minGap) out.pop();
    out.push(last);
  }
  return out;
}

/** Равномерная выборка k элементов ряда вместе с краями. */
function sample<T>(items: readonly T[], k: number): T[] {
  if (items.length <= k) return [...items];
  const taken = new Set<number>();
  const out: T[] = [];
  for (let i = 0; i < k; i += 1) {
    const idx = Math.round((i * (items.length - 1)) / (k - 1));
    if (taken.has(idx)) continue;
    taken.add(idx);
    out.push(items[idx]);
  }
  return out;
}

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
  const t1 = raw[raw.length - 1].ms;
  const span = t1 - t0 || 1;
  const values = raw.map((p) => p.sell);
  const lo = Math.min(...values);
  const hi = Math.max(...values);

  const scale = niceScale(lo, hi, Y_TICKS);
  const height = scale.max - scale.min;

  const fx = (ms: number) => ((ms - t0) / span) * 100;
  const fy = (v: number) => ((scale.max - v) / height) * 100;

  const all: ChartPoint[] = raw.map((p) => ({ ...p, fx: fx(p.ms), fy: fy(p.sell) }));

  const path = all
    .map((p, i) => `${i ? 'L' : 'M'}${p.fx.toFixed(3)},${p.fy.toFixed(3)}`)
    .join(' ');
  const areaPath = `M${all[0].fx.toFixed(3)},100 ${path.slice(1)} L${all[all.length - 1].fx.toFixed(3)},100 Z`;

  /**
   * Кружки: на коротком ряде — все точки, на длинном — только края и
   * экстремумы. Иначе на «Сутках» (сотня снапшотов) маркеры сливались
   * в сплошную полосу и прятали саму линию.
   */
  const iLo = values.indexOf(lo);
  const iHi = values.indexOf(hi);
  const markers = thinByGap(
    all.length <= MAX_MARKERS
      ? all
      : [...new Set([0, iLo, iHi, all.length - 1])].sort((a, b) => a - b).map((i) => all[i]),
    MIN_MARKER_GAP,
  );

  const yTicks = Array.from({ length: Y_TICKS }, (_, i) => {
    const value = scale.max - scale.step * i;
    return { value, fy: fy(value) };
  });

  return {
    path,
    areaPath,
    points: all,
    markers,
    tableRows: sample(all, MAX_TABLE_ROWS),
    xTicks: timeTicks(t0, t1).map((ms) => ({ ms, fx: fx(ms) })),
    yTicks,
    lo,
    hi,
    total: raw.length,
    spanMs: span,
  };
}
