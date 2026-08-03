import { describe, expect, it } from 'vitest';
import { counterAmount, isKztGive, isPlausibleTargetRate } from './exchange';

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

describe('isPlausibleTargetRate', () => {
  const current = 507; // текущий курс USD на момент написания теста

  it('сумма обмена вместо курса не проходит', () => {
    // ровно то, что заказчик ввёл в поле «Уведомить при курсе»
    expect(isPlausibleTargetRate(60_000_000, current)).toBe(false);
    expect(isPlausibleTargetRate(1_000_000, current)).toBe(false);
  });

  it('ожидание сильного движения курса проходит', () => {
    expect(isPlausibleTargetRate(600, current)).toBe(true);
    expect(isPlausibleTargetRate(420, current)).toBe(true);
    // ровно на границах допуска
    expect(isPlausibleTargetRate(current * 10, current)).toBe(true);
    expect(isPlausibleTargetRate(current / 10, current)).toBe(true);
  });

  it('за границами допуска — отказ', () => {
    expect(isPlausibleTargetRate(current * 10 + 1, current)).toBe(false);
    expect(isPlausibleTargetRate(current / 10 - 1, current)).toBe(false);
  });

  it('курс отделения ещё не загружен — не придираемся', () => {
    expect(isPlausibleTargetRate(600, 0)).toBe(true);
    expect(isPlausibleTargetRate(60_000_000, 0)).toBe(true);
  });

  it('мусор вместо курса не проходит', () => {
    expect(isPlausibleTargetRate(0, current)).toBe(false);
    expect(isPlausibleTargetRate(-5, current)).toBe(false);
    expect(isPlausibleTargetRate(Number.NaN, current)).toBe(false);
    expect(isPlausibleTargetRate(Number.POSITIVE_INFINITY, current)).toBe(false);
  });

  it('малые курсы (рубль, сом) работают так же', () => {
    expect(isPlausibleTargetRate(6.5, 6.01)).toBe(true);
    expect(isPlausibleTargetRate(500, 6.01)).toBe(false);
  });
});
