import { describe, expect, it } from 'vitest';
import { MAX_COLUMNS, Y_TICKS, buildChart, tickGranularity, type RawPoint } from './chart';

const DAY = 86_400_000;

describe('tickGranularity', () => {
  it('внутри суток — часы, недели-месяцы — даты, больше — месяцы', () => {
    expect(tickGranularity(6 * 3600_000)).toBe('time');
    expect(tickGranularity(2 * DAY)).toBe('time');
    expect(tickGranularity(5 * DAY)).toBe('date');
    expect(tickGranularity(30 * DAY)).toBe('date');
    expect(tickGranularity(120 * DAY)).toBe('month');
    expect(tickGranularity(365 * DAY)).toBe('month');
  });
});

/** Ряд из n точек по одной в сутки, значение задаётся функцией. */
function series(n: number, value: (i: number) => number): RawPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    t: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
    buy: value(i) - 5,
    sell: value(i),
  }));
}

describe('buildChart', () => {
  it('без данных и на одной точке линию не строит', () => {
    expect(buildChart(undefined)).toBeNull();
    expect(buildChart([])).toBeNull();
    expect(buildChart(series(1, () => 500))).toBeNull();
  });

  it('отбрасывает точки с нечитаемой датой или значением', () => {
    const chart = buildChart([
      { t: 'не дата', buy: 1, sell: 2 },
      { t: '2026-01-01', buy: 495, sell: 500 },
      { t: '2026-01-02', buy: 500, sell: 505 },
      { t: '2026-01-03', buy: 0, sell: Number.NaN },
    ]);
    expect(chart?.total).toBe(2);
  });

  it('нормирует крайние точки по X в 0 и 100 %', () => {
    const chart = buildChart(series(5, (i) => 500 + i));
    expect(chart).not.toBeNull();
    expect(chart?.columns[0].fx).toBeCloseTo(0);
    expect(chart?.columns.at(-1)?.fx).toBeCloseTo(100);
  });

  it('сортирует точки по времени, даже если API отдал их вперемешку', () => {
    const [a, b, c] = series(3, (i) => 500 + i);
    const chart = buildChart([c, a, b]);
    const ms = chart?.columns.map((col) => col.ms) ?? [];
    expect(ms).toEqual([...ms].sort((x, y) => x - y));
    expect(chart?.columns[0].sell).toBe(500);
  });

  it('максимум ряда лежит выше минимума и оба внутри поля графика', () => {
    const chart = buildChart(series(4, (i) => 500 + i));
    const ys = chart?.columns.map((col) => col.fy) ?? [];
    // fy растёт вниз: максимальное значение — наименьший fy
    expect(Math.min(...ys)).toBeGreaterThan(0);
    expect(Math.max(...ys)).toBeLessThan(100);
    expect(ys[0]).toBeGreaterThan(ys[ys.length - 1]);
  });

  it('плоский ряд не делит на ноль и кладёт линию в середину', () => {
    const chart = buildChart(series(6, () => 507));
    expect(chart).not.toBeNull();
    for (const col of chart?.columns ?? []) {
      expect(Number.isFinite(col.fy)).toBe(true);
      expect(col.fy).toBeCloseTo(50);
    }
    // подписи оси всё равно различаются — иначе ось выглядит сломанной
    const ticks = chart?.yTicks ?? [];
    expect(new Set(ticks.map((v) => v.toFixed(2))).size).toBe(Y_TICKS);
  });

  it('прореживает длинную историю до 12 колонок макета', () => {
    const chart = buildChart(series(500, (i) => 500 + Math.sin(i) * 3));
    expect(chart?.total).toBe(500);
    expect(chart?.columns).toHaveLength(MAX_COLUMNS);
    // первая и последняя колонки — реальные края ряда
    expect(chart?.columns[0].fx).toBeCloseTo(0);
    expect(chart?.columns.at(-1)?.fx).toBeCloseTo(100);
  });

  it('на короткой истории показывает все точки без дублей', () => {
    const chart = buildChart(series(5, (i) => 500 + i));
    expect(chart?.columns).toHaveLength(5);
    expect(new Set(chart?.columns.map((c) => c.ms)).size).toBe(5);
  });

  it('колонки — реальные точки ряда, поэтому маркер лежит на линии', () => {
    const chart = buildChart(series(40, (i) => 500 + (i % 7)));
    for (const col of chart?.columns ?? []) {
      expect(chart?.path).toContain(`${col.fx.toFixed(3)},${col.fy.toFixed(3)}`);
    }
  });

  it('ось Y идёт сверху вниз от максимума к минимуму ряда', () => {
    const chart = buildChart(series(10, (i) => 500 + i));
    const ticks = chart?.yTicks ?? [];
    expect(ticks).toHaveLength(Y_TICKS);
    expect(ticks[0]).toBeGreaterThan(chart?.hi ?? 0);
    expect(ticks[Y_TICKS - 1]).toBeLessThan(chart?.lo ?? 0);
    for (let i = 1; i < ticks.length; i += 1) expect(ticks[i]).toBeLessThan(ticks[i - 1]);
  });

  it('сохраняет курс покупки для таблицы-фоллбэка', () => {
    const chart = buildChart(series(3, (i) => 500 + i));
    expect(chart?.columns.map((c) => c.buy)).toEqual([495, 496, 497]);
  });

  it('отдаёт фактический размах ряда — по нему выбирается гранулярность оси', () => {
    // 6 суточных точек ⇒ размах 5 суток ⇒ ось в датах, а не в месяцах
    const chart = buildChart(series(6, () => 507));
    expect(chart).not.toBeNull();
    expect(chart!.spanMs).toBe(5 * DAY);
    expect(tickGranularity(chart!.spanMs)).toBe('date');
  });
});
