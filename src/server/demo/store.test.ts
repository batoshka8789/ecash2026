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

describe('demoSetPhone — смена номера в демо-режиме', () => {
  const OLD = '+7 (777) 111 11 11';
  const NEW = '+7 (777) 222 22 22';
  const PASSWORD = 'my-secret-1';

  it('после смены номера вход идёт по НОВОМУ номеру, старый больше не логин', () => {
    // регистрация: пароль ложится под ключ-номер
    store.demoSetPassword(OLD, PASSWORD);
    expect(store.demoCheckPassword(OLD, PASSWORD)).toBe(true);

    const accountId = store.demoAccount(OLD).accountId;
    store.demoSetPhone(accountId, NEW);

    // ровно то, на что жаловался заказчик: по новому номеру вход не выполнялся
    expect(store.demoCheckPassword(NEW, PASSWORD)).toBe(true);
    // телефон — это логин: после смены прежний номер входом быть перестаёт
    expect(store.demoCheckPassword(OLD, PASSWORD)).toBe(false);
  });

  it('аккаунт остаётся тем же и показывает новый номер', () => {
    const acc = store.demoAccount('+7 (700) 333 33 33');
    store.demoSetPhone(acc.accountId, '+7 (700) 444 44 44');

    // вход по новому номеру ведёт в ТОТ ЖЕ аккаунт (заявки не теряются)
    const after = store.demoAccount('+7 (700) 444 44 44');
    expect(after.accountId).toBe(acc.accountId);
    expect(after.phoneNumber).toBe('+7 (700) 444 44 44');
  });

  it('повторная смена переносит пароль дальше по цепочке', () => {
    const THIRD = '+7 (701) 999 99 99';
    store.demoSetPassword('+7 (701) 555 55 55', 'pw-2');
    const id = store.demoAccount('+7 (701) 555 55 55').accountId;
    store.demoSetPhone(id, '+7 (701) 777 77 77');
    store.demoSetPhone(id, THIRD);

    expect(store.demoCheckPassword(THIRD, 'pw-2')).toBe(true);
    expect(store.demoCheckPassword('+7 (701) 777 77 77', 'pw-2')).toBe(false);
    expect(store.demoCheckPassword('+7 (701) 555 55 55', 'pw-2')).toBe(false);
  });
});

describe('demoPhoneRetired — старый номер перестаёт быть логином целиком', () => {
  it('после смены старый номер в отставке (и общий пароль его не спасает)', () => {
    const OLD = '+7 (702) 100 00 01';
    const NEW = '+7 (702) 100 00 02';
    const id = store.demoAccount(OLD).accountId;
    store.demoSetPhone(id, NEW);

    // login-роуты проверяют отставку ДО пароля: сюда упирается и вход с
    // 'ecash2026', и вход по SMS-коду — оба раньше пускали по старому номеру
    expect(store.demoPhoneRetired(OLD)).toBe(true);
    expect(store.demoPhoneRetired(NEW)).toBe(false);
    // формат не важен — сравнение по цифрам
    expect(store.demoPhoneRetired('87021000001')).toBe(false); // другой префикс = другие цифры
    expect(store.demoPhoneRetired('+7702-100-00-01')).toBe(true);
  });

  it('вся цепочка смен в отставке, кроме текущего номера', () => {
    const A = '+7 (703) 200 00 01';
    const B = '+7 (703) 200 00 02';
    const C = '+7 (703) 200 00 03';
    const id = store.demoAccount(A).accountId;
    store.demoSetPhone(id, B);
    store.demoSetPhone(id, C);

    expect(store.demoPhoneRetired(A)).toBe(true);
    expect(store.demoPhoneRetired(B)).toBe(true);
    expect(store.demoPhoneRetired(C)).toBe(false);
  });

  it('возврат на прежний номер снимает его отставку', () => {
    const A = '+7 (704) 300 00 01';
    const B = '+7 (704) 300 00 02';
    const id = store.demoAccount(A).accountId;
    store.demoSetPhone(id, B);
    expect(store.demoPhoneRetired(A)).toBe(true);
    store.demoSetPhone(id, A); // передумал — вернул старый номер
    expect(store.demoPhoneRetired(A)).toBe(false);
    expect(store.demoPhoneRetired(B)).toBe(true);
  });

  it('повторная регистрация возвращает освободившийся номер в строй', () => {
    const A = '+7 (705) 400 00 01';
    const B = '+7 (705) 400 00 02';
    const id = store.demoAccount(A).accountId;
    store.demoSetPhone(id, B);
    expect(store.demoPhoneRetired(A)).toBe(true);

    store.demoUnretirePhone(A); // register-роут делает это перед созданием
    expect(store.demoPhoneRetired(A)).toBe(false);
  });
});
