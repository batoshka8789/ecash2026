import { describe, expect, it } from 'vitest';
import { iso, normalizeCoords, num } from './coerce';

describe('num', () => {
  it('парсит строки с точкой и запятой', () => {
    expect(num('539.40')).toBe(539.4);
    expect(num('539,40')).toBe(539.4);
    expect(num('1 000 000,5')).toBe(1000000.5);
  });
  it('никогда не возвращает NaN', () => {
    expect(num('abc')).toBe(0);
    expect(num(null)).toBe(0);
    expect(num(undefined, 7)).toBe(7);
    expect(num(Infinity, 3)).toBe(3);
  });
  it('числа проходят как есть', () => {
    expect(num(521.5)).toBe(521.5);
  });
});

describe('iso', () => {
  it('дописывает Z к дате без таймзоны (upstream отдаёт UTC)', () => {
    expect(iso('2026-07-23T09:15:00')).toBe('2026-07-23T09:15:00Z');
  });
  it('не трогает дату с таймзоной', () => {
    expect(iso('2026-07-23T09:15:00Z')).toBe('2026-07-23T09:15:00Z');
    expect(iso('2026-01-23T04:40:17.272535+00:00')).toBe('2026-01-23T04:40:17.272535+00:00');
  });
  it('null на мусор', () => {
    expect(iso('')).toBeNull();
    expect(iso('не дата')).toBeNull();
    expect(iso(42)).toBeNull();
  });
});

describe('normalizeCoords — своп перепутанных lat/lon', () => {
  it('переворачивает координаты Алматы (реальный ответ depInfo)', () => {
    // depId 1: lat=76.850845, lon=43.237542 — на деле долгота и широта
    expect(normalizeCoords('76.850845', '43.237542', 1)).toEqual({
      lat: 43.237542,
      lon: 76.850845,
    });
  });
  it('переворачивает координаты Астаны', () => {
    expect(normalizeCoords('71.404164', '51.132516', 11)).toEqual({
      lat: 51.132516,
      lon: 71.404164,
    });
  });
  it('правильные координаты проходят без изменений', () => {
    expect(normalizeCoords('43.237542', '76.850845', 1)).toEqual({
      lat: 43.237542,
      lon: 76.850845,
    });
  });
  it('вне Казахстана — null, не угадываем', () => {
    expect(normalizeCoords('10', '10', 99)).toBeNull();
    expect(normalizeCoords('abc', '76.9', 99)).toBeNull();
  });
});
