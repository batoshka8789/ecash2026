import { describe, expect, it } from 'vitest';
import { counterAmount, isKztGive } from './exchange';

describe('isKztGive', () => {
  it('тенге отдаём — обменник продаёт валюту', () => {
    expect(isKztGive('KZT')).toBe(true);
    expect(isKztGive('USD')).toBe(false);
    expect(isKztGive('GOLD1')).toBe(false);
  });
});

describe('counterAmount', () => {
  it('отдаём тенге — делим на курс', () => {
    // ровно тот случай, который был сломан: показывалось 541 680 000
    expect(counterAmount(1_000_000, 541.68, 'KZT')).toBeCloseTo(1846.11, 2);
    expect(counterAmount(100_000, 146.26, 'KZT')).toBeCloseTo(683.71, 2);
  });

  it('отдаём валюту — умножаем на курс', () => {
    expect(counterAmount(100, 541.68, 'USD')).toBeCloseTo(54_168, 2);
    expect(counterAmount(100, 3.48, 'INR')).toBeCloseTo(348, 2);
  });

  it('обратный пересчёт возвращает исходную сумму', () => {
    const give = 1_000_000;
    const got = counterAmount(give, 541.68, 'KZT');
    expect(counterAmount(got, 541.68, 'USD')).toBeCloseTo(give, 6);
  });

  it('негодный курс даёт 0, а не Infinity/NaN', () => {
    expect(counterAmount(1000, 0, 'KZT')).toBe(0);
    expect(counterAmount(1000, -5, 'KZT')).toBe(0);
    expect(counterAmount(1000, Number.NaN, 'KZT')).toBe(0);
    expect(counterAmount(Number.NaN, 500, 'KZT')).toBe(0);
  });
});
