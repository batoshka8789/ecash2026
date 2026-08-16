import { describe, expect, it } from 'vitest';

// модуль тянет db/client → env: валидное окружение нужно до импорта
process.env.ECASH_API_BASE_URL = 'https://api-dev.quiq.kz';
process.env.ECASH_CLIENT_ID = 'test';
process.env.ECASH_CLIENT_SECRET = 'test';
process.env.SESSION_SECRET = Buffer.alloc(32, 7).toString('base64');
process.env.DATABASE_URL = 'postgres://t:t@localhost:5432/t';
process.env.APP_ORIGIN = 'http://localhost:3000';

const { isTerminal, watchEvents } = await import('./request-watch');
const { requestEventText, toPushLocale } = await import('./push-text');
import type { ExchangeRequest } from '@/lib/domain';

/**
 * Переходы наблюдателя заявок — то, ради чего человек получает push, когда
 * его нет на сайте. Семантика статусов: 0 Введен · 8 Забронирована ·
 * 1 Проведена · 3 Отмена.
 */

const st = (status: number, needsConfirm = false) => ({ status, needsConfirm });

describe('watchEvents — решения казначея', () => {
  it('казначей подтвердил бронь: 0 → 8', () => {
    expect(watchEvents(st(0), st(8))).toEqual(['confirmed']);
  });

  it('казначей ответил по индивидуальному курсу', () => {
    expect(watchEvents(st(0, false), st(0, true))).toEqual(['offer']);
  });

  it('заявка отклонена: 0 → 3', () => {
    expect(watchEvents(st(0), st(3))).toEqual(['cancelled']);
  });

  it('обмен проведён: 8 → 1', () => {
    expect(watchEvents(st(8), st(1))).toEqual(['done']);
  });

  it('проведена сразу, минуя бронь: 0 → 1 — одно событие, не два', () => {
    expect(watchEvents(st(0), st(1))).toEqual(['done']);
  });

  it('ничего не изменилось — тишина', () => {
    expect(watchEvents(st(0), st(0))).toEqual([]);
    expect(watchEvents(st(8), st(8))).toEqual([]);
    expect(watchEvents(st(0, true), st(0, true))).toEqual([]);
  });

  it('needsConfirm при уже подтверждённой броне не даёт «offer»', () => {
    // offer имеет смысл только в статусе 0 — ждём решения клиента
    expect(watchEvents(st(8, false), st(8, true))).toEqual([]);
  });

  it('подтверждение клиентом: offer → бронь (needsConfirm гаснет, статус 8)', () => {
    expect(watchEvents(st(0, true), st(8, false))).toEqual(['confirmed']);
  });
});

describe('isTerminal', () => {
  it('проведена и отменена — финал; введена и бронь — нет', () => {
    expect(isTerminal(1)).toBe(true);
    expect(isTerminal(3)).toBe(true);
    expect(isTerminal(0)).toBe(false);
    expect(isTerminal(8)).toBe(false);
  });
});

describe('requestEventText — тексты на всех языках', () => {
  const req = {
    requestId: 6717,
    currencyFrom: 'KZT',
    currencyTo: 'USD',
    rate: 526.4,
  } as ExchangeRequest;

  it.each(['ru', 'en', 'kk', 'zh'] as const)('%s: все четыре события собираются', (locale) => {
    for (const event of ['confirmed', 'done', 'cancelled', 'offer'] as const) {
      const t = requestEventText(locale, event, req);
      expect(t.title.length).toBeGreaterThan(3);
      expect(t.body).toContain('6717');
      expect(t.body).toContain('KZT');
    }
  });

  it('курс форматируется по языку устройства', () => {
    expect(requestEventText('ru', 'confirmed', req).body).toContain('526,4');
    expect(requestEventText('en', 'confirmed', req).body).toContain('526.4');
  });
});

describe('toPushLocale', () => {
  it('неизвестное — русский', () => {
    expect(toPushLocale('de')).toBe('ru');
    expect(toPushLocale(null)).toBe('ru');
    expect(toPushLocale('kk')).toBe('kk');
  });
});
