import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EcashError } from '@/server/ecash/errors';

/**
 * Жизненный цикл демо-заявки: терминальные состояния должны отвечать 409-кодами,
 * а не «тихим» успехом. env.ts валидирует окружение при импорте — задаём
 * переменные до динамического импорта (как в session-crypto.test.ts).
 */

let store: typeof import('./store');

beforeAll(async () => {
  process.env.ECASH_API_BASE_URL = 'https://api-dev.quiq.kz';
  process.env.ECASH_CLIENT_ID = 'test';
  process.env.ECASH_CLIENT_SECRET = 'test';
  process.env.SESSION_SECRET = Buffer.from(new Uint8Array(32).fill(7)).toString('base64');
  process.env.DATABASE_URL = 'postgres://test';
  process.env.APP_ORIGIN = 'http://localhost:3000';
  store = await import('./store');
});

// казначей-симулятор ставит setTimeout — держим таймеры фейковыми,
// чтобы управлять его ответом и не оставлять висящих таймеров
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const reserveBody = () => ({
  currencyFrom: 'USD',
  currencyTo: 'KZT',
  value: 100,
  rate: 519.7,
  amount: 51970,
  depId: 5,
});

function catchEcash(fn: () => unknown): EcashError {
  try {
    fn();
  } catch (e) {
    return e as EcashError;
  }
  throw new Error('ожидалось исключение EcashError');
}

describe('demoCancel', () => {
  it('активная заявка отменяется', () => {
    const acc = 'acc-cancel-ok';
    const req = store.demoCreate(acc, reserveBody(), false);
    const r = store.demoCancel(acc, req.requestId);
    expect(r?.status).toBe(3);
  });

  it('повторная отмена уже отменённой — 409 REQUEST_NOT_CANCELLABLE', () => {
    const acc = 'acc-cancel-twice';
    const req = store.demoCreate(acc, reserveBody(), false);
    store.demoCancel(acc, req.requestId);
    const err = catchEcash(() => store.demoCancel(acc, req.requestId));
    expect(err.code).toBe('REQUEST_NOT_CANCELLABLE');
    expect(err.httpStatus).toBe(409);
  });

  it('проведённая заявка (статус 1) не отменяется', () => {
    const acc = 'acc-cancel-done';
    const req = store.demoCreate(acc, reserveBody(), false);
    req.status = 1; // «Проведена» — терминальный статус
    const err = catchEcash(() => store.demoCancel(acc, req.requestId));
    expect(err.code).toBe('REQUEST_NOT_CANCELLABLE');
  });

  it('неизвестная заявка → null', () => {
    expect(store.demoCancel('acc-cancel-none', 987654)).toBeNull();
  });
});

describe('demoConfirmIndividual / demoRejectIndividual', () => {
  it('обычная бронь не подтверждается как индивидуальный курс', () => {
    const acc = 'acc-ind-notind';
    const req = store.demoCreate(acc, reserveBody(), false);
    const err = catchEcash(() => store.demoConfirmIndividual(acc, req.requestId));
    expect(err.code).toBe('NOT_INDIVIDUAL_REQUEST');
    expect(err.httpStatus).toBe(409);
  });

  it('до ответа казначея подтверждать нечего', () => {
    const acc = 'acc-ind-early';
    const req = store.demoCreate(acc, reserveBody(), true);
    const err = catchEcash(() => store.demoConfirmIndividual(acc, req.requestId));
    expect(err.code).toBe('RATE_NOT_CONFIRMED');
  });

  it('после подтверждения повторный confirm — REQUEST_NOT_ACTIVE', () => {
    const acc = 'acc-ind-twice';
    const req = store.demoCreate(acc, reserveBody(), true);
    vi.advanceTimersByTime(store.TREASURER_DELAY_MS + 1000); // казначей предложил курс
    const confirmed = store.demoConfirmIndividual(acc, req.requestId);
    expect(confirmed?.status).toBe(8);
    const err = catchEcash(() => store.demoConfirmIndividual(acc, req.requestId));
    expect(err.code).toBe('REQUEST_NOT_ACTIVE');
    expect(err.httpStatus).toBe(409);
  });

  it('reject отменённой ранее заявки — REQUEST_NOT_ACTIVE', () => {
    const acc = 'acc-ind-reject-twice';
    const req = store.demoCreate(acc, reserveBody(), true);
    vi.advanceTimersByTime(store.TREASURER_DELAY_MS + 1000);
    const rejected = store.demoRejectIndividual(acc, req.requestId);
    expect(rejected?.status).toBe(3);
    const err = catchEcash(() => store.demoRejectIndividual(acc, req.requestId));
    expect(err.code).toBe('REQUEST_NOT_ACTIVE');
  });

  it('просроченное предложение — RATE_EXPIRED', () => {
    const acc = 'acc-ind-expired';
    const req = store.demoCreate(acc, reserveBody(), true);
    vi.advanceTimersByTime(store.TREASURER_DELAY_MS + 1000); // предложение действует 60 минут
    vi.advanceTimersByTime(61 * 60_000);
    const err = catchEcash(() => store.demoConfirmIndividual(acc, req.requestId));
    expect(err.code).toBe('RATE_EXPIRED');
  });

  it('неизвестная заявка → null', () => {
    expect(store.demoConfirmIndividual('acc-ind-none', 987654)).toBeNull();
  });
});
