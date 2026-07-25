import 'server-only';
import { env } from '@/server/env';
import type { Account, ExchangeRequest, OperationsPage, RequestAccept } from '@/lib/domain';
import { phaseOf, sideOf } from '@/server/ecash/mappers';
import { EcashError } from '@/server/ecash/errors';
import type { ReserveBody } from '@/server/ecash/endpoints/reserve';

/**
 * Демо-режим (только ECASH_OTP_MOCK=1): полный цикл брони без реальных SMS
 * и без тестового аккаунта Ecash. «Казначей»-симулятор подтверждает заявку
 * через несколько секунд. В продакшене недостижимо: env.ts запрещает флаг.
 */

export const DEMO_TOKEN = 'demo-token';
export const DEMO_OTP = '000000';

export const isDemoToken = (token: string) => env.ECASH_OTP_MOCK && token === DEMO_TOKEN;

export function demoAccount(phone: string): Account {
  return {
    accountId: `demo-${phone.replace(/\D/g, '')}`,
    phoneNumber: phone,
    isLinkedToClient: true,
    clientId: 5512,
    iin: null,
    firstName: 'Фёдор',
    lastName: 'Михайлович',
    middleName: '',
  };
}

type DemoDb = { requests: Map<string, ExchangeRequest[]>; nextId: number };
const g = globalThis as unknown as { __ecashDemo?: DemoDb };
const store: DemoDb = (g.__ecashDemo ??= { requests: new Map(), nextId: 10432 });

const TREASURER_DELAY_MS = 8000;
const HOLD_MINUTES = 60;

const list = (accountId: string) => {
  let arr = store.requests.get(accountId);
  if (!arr) store.requests.set(accountId, (arr = []));
  return arr;
};

/** Пересчёт истечения при каждом чтении — как на реальном сервере. */
function withExpiry(r: ExchangeRequest): ExchangeRequest {
  if (r.status === 8 && r.reservedUntil && Date.parse(r.reservedUntil) < Date.now()) {
    return {
      ...r,
      status: 3,
      statusName: 'Отмена',
      phase: 'cancelled',
      isExpired: true,
      acceptComment: 'Срок брони истёк',
    };
  }
  if (r.needsClientConfirmation && r.reservedUntil && Date.parse(r.reservedUntil) < Date.now()) {
    return { ...r, needsClientConfirmation: false, isExpired: true };
  }
  return r;
}

function treasurerAccept(actionType: 1 | 2, rate: number, value: number, amount: number): RequestAccept {
  return {
    acceptId: store.nextId++,
    actionType,
    actionTypeName: actionType === 1 ? 'Резервирование' : 'Индивидуальный курс',
    status: 2,
    statusName: 'Подтверждена',
    rate,
    amount,
    value,
    createdAt: new Date().toISOString(),
    answeredAt: new Date().toISOString(),
  };
}

export function demoCreate(accountId: string, body: ReserveBody, individual: boolean): ExchangeRequest {
  const existing = list(accountId).find(
    (r) =>
      withExpiry(r).status === 0 ||
      (withExpiry(r).status === 8 &&
        r.currencyFrom === body.currencyFrom &&
        r.currencyTo === body.currencyTo &&
        (r.depId ?? 0) === (body.depId ?? 0)),
  );
  if (existing && existing.currencyFrom === body.currencyFrom && existing.currencyTo === body.currencyTo) {
    const err = new Error('duplicate') as Error & { demoDuplicate?: ExchangeRequest };
    err.demoDuplicate = withExpiry(existing);
    throw err;
  }

  const now = new Date().toISOString();
  const req: ExchangeRequest = {
    requestId: store.nextId++,
    status: 0,
    statusName: 'Введен',
    phase: 'pending',
    needsClientConfirmation: false,
    clientId: 5512,
    currencyFrom: body.currencyFrom,
    currencyTo: body.currencyTo,
    value: body.value,
    rate: body.rate,
    amount: body.amount,
    actionType: sideOf(body.currencyFrom),
    depId: body.depId ?? null,
    kassaId: body.kassaId ?? null,
    isReserve: !individual,
    isIndividual: individual,
    reserveMinutes: HOLD_MINUTES,
    reservedAt: null,
    reservedUntil: null,
    isExpired: false,
    acceptStatus: null,
    acceptComment: null,
    // тип купюр из формы приходит комментарием — показываем его в карточке
    comment: body.comment ?? null,
    treasurerLogin: null,
    printedTicket: null,
    createdAt: now,
    updatedAt: now,
    accepts: [],
    history: [],
  };
  list(accountId).unshift(req);

  // «казначей» отвечает через несколько секунд
  setTimeout(() => {
    const r = list(accountId).find((x) => x.requestId === req.requestId);
    if (!r || r.status !== 0) return;
    const answeredAt = new Date();
    const until = new Date(answeredAt.getTime() + HOLD_MINUTES * 60_000).toISOString();
    if (individual) {
      // индивидуальный курс: казначей предлагает курс чуть лучше запрошенного
      const offered = Math.round(r.rate * 0.995 * 100) / 100;
      r.accepts.push(treasurerAccept(2, offered, r.value, Math.round(r.value * offered)));
      r.rate = offered;
      r.amount = Math.round(r.value * offered);
      r.needsClientConfirmation = true;
      r.reservedAt = answeredAt.toISOString();
      r.reservedUntil = until;
    } else {
      r.accepts.push(treasurerAccept(1, r.rate, r.value, r.amount));
      r.status = 8;
      r.statusName = 'Забронирована';
      r.phase = 'held';
      r.acceptStatus = 2;
      r.treasurerLogin = 'kaznachey01';
      r.reservedAt = answeredAt.toISOString();
      r.reservedUntil = until;
    }
    r.updatedAt = answeredAt.toISOString();
    r.history.push({
      updatedAt: r.updatedAt,
      oldStatus: 0,
      oldStatusName: 'Введен',
      status: r.status,
      statusName: r.statusName,
      action: individual ? 'individual-rate' : 'reserve',
      rate: r.rate,
      value: r.value,
      amount: r.amount,
    });
  }, TREASURER_DELAY_MS);

  return req;
}

export function demoGet(accountId: string, requestId: number): ExchangeRequest | null {
  const r = list(accountId).find((x) => x.requestId === requestId);
  return r ? withExpiry(r) : null;
}

export function demoList(accountId: string, page: number, pageSize: number): OperationsPage {
  const all = list(accountId).map(withExpiry);
  return {
    accountId,
    clientId: 5512,
    page,
    pageSize,
    total: all.length,
    requests: all.slice((page - 1) * pageSize, page * pageSize),
  };
}

export function demoCancel(accountId: string, requestId: number): ExchangeRequest | null {
  const r = list(accountId).find((x) => x.requestId === requestId);
  if (!r) return null;
  const cur = withExpiry(r);
  // терминальные статусы (1 Проведена / 3 Отмена, в т.ч. истёкшая бронь) — как upstream: 409
  if (cur.status !== 0 && cur.status !== 8) {
    throw new EcashError('REQUEST_NOT_CANCELLABLE', 409, `request ${requestId} in status ${cur.status}`);
  }
  Object.assign(r, {
    status: 3,
    statusName: 'Отмена',
    phase: phaseOf(3),
    needsClientConfirmation: false,
    updatedAt: new Date().toISOString(),
  });
  return r;
}

/**
 * Подтверждать/отклонять индивидуальный курс можно только пока заявка
 * ждёт решения клиента — иначе 409 с точным кодом, как у upstream.
 */
function assertAwaitingDecision(cur: ExchangeRequest): void {
  if (cur.needsClientConfirmation) return;
  if (!cur.isIndividual) {
    throw new EcashError('NOT_INDIVIDUAL_REQUEST', 409, `request ${cur.requestId} is not individual`);
  }
  if (cur.isExpired) {
    throw new EcashError('RATE_EXPIRED', 409, `request ${cur.requestId} offer expired`);
  }
  if (cur.status === 0) {
    throw new EcashError('RATE_NOT_CONFIRMED', 409, `request ${cur.requestId} has no treasurer answer yet`);
  }
  throw new EcashError('REQUEST_NOT_ACTIVE', 409, `request ${cur.requestId} in status ${cur.status}`);
}

export function demoConfirmIndividual(accountId: string, requestId: number): ExchangeRequest | null {
  const r = list(accountId).find((x) => x.requestId === requestId);
  if (!r) return null;
  assertAwaitingDecision(withExpiry(r));
  const until = new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString();
  Object.assign(r, {
    status: 8,
    statusName: 'Забронирована',
    phase: phaseOf(8),
    needsClientConfirmation: false,
    acceptStatus: 2,
    treasurerLogin: 'kaznachey01',
    reservedAt: new Date().toISOString(),
    reservedUntil: until,
    updatedAt: new Date().toISOString(),
  });
  r.accepts.push(treasurerAccept(1, r.rate, r.value, r.amount));
  return r;
}

export function demoRejectIndividual(accountId: string, requestId: number): ExchangeRequest | null {
  const r = list(accountId).find((x) => x.requestId === requestId);
  if (!r) return null;
  assertAwaitingDecision(withExpiry(r));
  Object.assign(r, {
    status: 3,
    statusName: 'Отмена',
    phase: phaseOf(3),
    needsClientConfirmation: false,
    acceptComment: 'Клиент отказался от предложенного курса',
    updatedAt: new Date().toISOString(),
  });
  return r;
}
