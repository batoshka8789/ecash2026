import { describe, expect, it } from 'vitest';
import { alertCurrency, alertDirection, alertReached } from './rate-alert';

describe('alertDirection / alertCurrency', () => {
  it('KZT→валюта — покупка', () => {
    expect(alertDirection('KZT', 'USD')).toBe('buying');
    expect(alertCurrency('KZT', 'USD')).toBe('USD');
  });

  it('валюта→KZT — продажа', () => {
    expect(alertDirection('USD', 'KZT')).toBe('selling');
    expect(alertCurrency('USD', 'KZT')).toBe('USD');
  });

  it('пара без тенге направления не задаёт', () => {
    expect(alertDirection('USD', 'EUR')).toBeNull();
    expect(alertCurrency('USD', 'EUR')).toBeNull();
    expect(alertDirection('KZT', 'KZT')).toBeNull();
  });
});

describe('alertReached — покупка (ждём, когда подешевеет)', () => {
  it('курс продажи опустился ниже отметки — сработало', () => {
    expect(alertReached('buying', 500, 491)).toBe(true);
  });

  it('ровно отметка — сработало', () => {
    expect(alertReached('buying', 500, 500)).toBe(true);
  });

  it('курс всё ещё выше отметки — молчим', () => {
    expect(alertReached('buying', 500, 507)).toBe(false);
  });

  /** Тот самый случай, на котором ловилась перевёрнутая проверка. */
  it('свежая подписка при курсе выше отметки не срабатывает сразу', () => {
    expect(alertReached('buying', 500, 507)).toBe(false);
  });
});

describe('alertReached — продажа (ждём, когда подорожает)', () => {
  it('курс покупки поднялся выше отметки — сработало', () => {
    expect(alertReached('selling', 550, 553)).toBe(true);
  });

  it('ровно отметка — сработало', () => {
    expect(alertReached('selling', 550, 550)).toBe(true);
  });

  it('курс ещё ниже отметки — молчим', () => {
    expect(alertReached('selling', 550, 540)).toBe(false);
  });
});

describe('alertReached — отсутствие данных', () => {
  it('курса нет — не срабатывание', () => {
    expect(alertReached('buying', 500, undefined)).toBe(false);
    expect(alertReached('selling', 500, undefined)).toBe(false);
  });

  it('нулевой курс не считается достигнутым', () => {
    expect(alertReached('buying', 500, 0)).toBe(false);
  });

  it('битая отметка не срабатывает', () => {
    expect(alertReached('buying', 0, 491)).toBe(false);
    expect(alertReached('buying', Number.NaN, 491)).toBe(false);
  });
});
