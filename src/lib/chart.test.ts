import { describe, expect, it } from 'vitest';
import {
  MAX_MARKERS,
  MAX_TABLE_ROWS,
  MIN_MARKER_GAP,
  Y_TICKS,
  buildChart,
  tickGranularity,
  timeTicks,
  type RawPoint,
} from './chart';

const HOUR = 3_600_000;
const DAY = 86_400_000;

describe('tickGranularity', () => {
  it('внутри суток — часы, недели-месяцы — даты, больше — месяцы', () => {
    expect(tickGranularity(6 * HOUR)).toBe('time');
    expect(tickGranularity(2 * DAY)).toBe('time');
    expect(tickGranularity(5 * DAY)).toBe('date');
    expect(tickGranularity(30 * DAY)).toBe('date');
    expect(tickGranularity(120 * DAY)).toBe('month');
    expect(tickGranularity(365 * DAY)).toBe('month');
  });
});

describe('timeTicks', () => {
  it('шаг растёт вместе с размахом, отметок не больше запрошенного', () => {
    for (const span of [HOUR, 6 * HOUR, DAY, 7 * DAY, 30 * DAY, 365 * DAY]) {
      const t0 = Date.UTC(2026, 0, 1, 3, 17);
      const ticks = timeTicks(t0, t0 + span, 6);
      expect(ticks.length).toBeGreaterThan(0);
      expect(ticks.length).toBeLessThanOrEqual(6);
      // отметки строго возрастают и лежат внутри ряда
      for (let i = 1; i < ticks.length; i += 1) expect(ticks[i]).toBeGreaterThan(ticks[i - 1]);
      expect(ticks[0]).toBeGreaterThanOrEqual(t0);
      expect(ticks[ticks.length - 1]).toBeLessThanOrEqual(t0 + span);
    }
  });

  it('шаг равномерный — сетка не сбивается в частокол', () => {
    const t0 = Date.UTC(2026, 0, 1, 3, 17);
    const ticks = timeTicks(t0, t0 + 7 * DAY, 6);
    const steps = ticks.slice(1).map((ms, i) => ms - ticks[i]);
    expect(new Set(steps).size).toBe(1);
  });

  it('суточный шаг встаёт на локальную полночь', () => {
    const t0 = new Date(2026, 0, 1, 3, 17).getTime();
    for (const ms of timeTicks(t0, t0 + 5 * DAY, 6)) {
      const d = new Date(ms);
      expect([d.getHours(), d.getMinutes()]).toEqual([0, 0]);
    }
  });

  it('на вырожденном ряде отдаёт хотя бы одну отметку, а не пустоту', () => {
    // ряд «все точки в одну миллисекунду» — ось всё равно должна быть подписана
    for (const t0 of [Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 1, 3, 17, 42)]) {
      const ticks = timeTicks(t0, t0, 6);
      expect(ticks.length).toBeGreaterThan(0);
      for (const ms of ticks) expect(ms).toBe(t0);
    }
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
    expect(chart?.points[0].fx).toBeCloseTo(0);
    expect(chart?.points.at(-1)?.fx).toBeCloseTo(100);
  });

  it('сортирует точки по времени, даже если API отдал их вперемешку', () => {
    const [a, b, c] = series(3, (i) => 500 + i);
    const chart = buildChart([c, a, b]);
    const ms = chart?.points.map((p) => p.ms) ?? [];
    expect(ms).toEqual([...ms].sort((x, y) => x - y));
    expect(chart?.points[0].sell).toBe(500);
  });

  it('весь ряд помещается в поле графика', () => {
    const chart = buildChart(series(4, (i) => 500 + i));
    const ys = chart?.points.map((p) => p.fy) ?? [];
    // fy растёт вниз: максимальное значение — наименьший fy
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(100);
    expect(ys[0]).toBeGreaterThan(ys[ys.length - 1]);
  });

  it('плоский ряд не делит на ноль и кладёт линию внутрь поля', () => {
    const chart = buildChart(series(6, () => 507));
    expect(chart).not.toBeNull();
    for (const p of chart?.points ?? []) {
      expect(Number.isFinite(p.fy)).toBe(true);
      expect(p.fy).toBeGreaterThan(10);
      expect(p.fy).toBeLessThan(90);
    }
    // подписи оси всё равно различаются — иначе ось выглядит сломанной
    const ticks = chart?.yTicks ?? [];
    expect(new Set(ticks.map((t) => t.value.toFixed(4))).size).toBe(Y_TICKS);
  });

  it('ось Y — «круглые» значения с равным шагом', () => {
    const chart = buildChart(series(10, (i) => 500 + i * 0.37));
    const ticks = chart?.yTicks ?? [];
    expect(ticks).toHaveLength(Y_TICKS);
    const step = ticks[0].value - ticks[1].value;
    for (let i = 1; i < ticks.length; i += 1) {
      expect(ticks[i - 1].value - ticks[i].value).toBeCloseTo(step, 9);
      expect(ticks[i].value).toBeLessThan(ticks[i - 1].value);
    }
    // границы шкалы кратны шагу — отсюда и читаемые подписи
    expect(Math.abs(ticks[Y_TICKS - 1].value / step - Math.round(ticks[Y_TICKS - 1].value / step)))
      .toBeLessThan(1e-6);
    // и весь ряд внутри шкалы
    expect(ticks[0].value).toBeGreaterThanOrEqual(chart!.hi);
    expect(ticks[Y_TICKS - 1].value).toBeLessThanOrEqual(chart!.lo);
  });

  it('линии сетки Y совпадают с подписями', () => {
    const chart = buildChart(series(8, (i) => 500 + i));
    const ys = chart?.yTicks.map((t) => t.fy) ?? [];
    expect(ys[0]).toBeCloseTo(0);
    expect(ys[ys.length - 1]).toBeCloseTo(100);
  });

  it('на длинном ряде кружки остаются только на краях и экстремумах', () => {
    const chart = buildChart(series(500, (i) => 500 + Math.sin(i) * 3));
    expect(chart?.total).toBe(500);
    expect(chart?.points).toHaveLength(500);
    expect(chart?.markers.length).toBeLessThanOrEqual(4);
    expect(chart?.markers[0].fx).toBeCloseTo(0);
    expect(chart?.markers.at(-1)?.fx).toBeCloseTo(100);
  });

  it('на короткой равномерной истории кружки стоят на всех точках', () => {
    const chart = buildChart(series(5, (i) => 500 + i));
    expect(chart?.markers).toHaveLength(5);
    expect(MAX_MARKERS).toBeGreaterThan(5);
  });

  it('слипшиеся по времени точки прореживаются, последняя остаётся', () => {
    // сутки: одна точка утром и десять подряд с шагом в минуту вечером
    const base = Date.UTC(2026, 0, 1);
    const raw: RawPoint[] = [
      { t: new Date(base).toISOString(), buy: 500, sell: 505 },
      ...Array.from({ length: 10 }, (_, i) => ({
        t: new Date(base + 20 * 3_600_000 + i * 60_000).toISOString(),
        buy: 500,
        sell: 505,
      })),
    ];
    const chart = buildChart(raw);
    expect(chart?.points).toHaveLength(11);
    // вечерняя пачка укладывается в доли процента ширины — от неё остаётся одна
    expect(chart?.markers).toHaveLength(2);
    expect(chart?.markers.at(-1)?.ms).toBe(chart?.points.at(-1)?.ms);
    const gaps =
      chart?.markers.slice(1).map((m, i) => m.fx - chart.markers[i].fx) ?? [];
    for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(MIN_MARKER_GAP);
  });

  it('кружки лежат ровно на линии', () => {
    const chart = buildChart(series(40, (i) => 500 + (i % 7)));
    for (const m of chart?.markers ?? []) {
      expect(chart?.path).toContain(`${m.fx.toFixed(3)},${m.fy.toFixed(3)}`);
    }
  });

  it('заливка замкнута по низу поля', () => {
    const chart = buildChart(series(4, (i) => 500 + i));
    expect(chart?.areaPath.startsWith('M0.000,100')).toBe(true);
    expect(chart?.areaPath.endsWith('L100.000,100 Z')).toBe(true);
  });

  it('таблица-фоллбэк прорежена и сохраняет курс покупки', () => {
    const chart = buildChart(series(500, (i) => 500 + i));
    expect(chart?.tableRows.length).toBeLessThanOrEqual(MAX_TABLE_ROWS);
    expect(chart?.tableRows[0].buy).toBe(495);
    const short = buildChart(series(3, (i) => 500 + i));
    expect(short?.tableRows.map((c) => c.buy)).toEqual([495, 496, 497]);
  });

  it('отдаёт фактический размах ряда — по нему выбирается гранулярность оси', () => {
    // 6 суточных точек ⇒ размах 5 суток ⇒ ось в датах, а не в месяцах
    const chart = buildChart(series(6, () => 507));
    expect(chart).not.toBeNull();
    expect(chart!.spanMs).toBe(5 * DAY);
    expect(tickGranularity(chart!.spanMs)).toBe('date');
  });

  it('отметки времени лежат внутри ряда и идут по возрастанию', () => {
    const chart = buildChart(series(30, (i) => 500 + i));
    const ticks = chart?.xTicks ?? [];
    expect(ticks.length).toBeGreaterThan(1);
    for (const tick of ticks) {
      expect(tick.fx).toBeGreaterThanOrEqual(0);
      expect(tick.fx).toBeLessThanOrEqual(100);
    }
    for (let i = 1; i < ticks.length; i += 1) expect(ticks[i].fx).toBeGreaterThan(ticks[i - 1].fx);
  });
});
