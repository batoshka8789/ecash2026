import 'server-only';
import { env } from '@/server/env';
import type { Account, ExchangeRequest, OperationsPage, RequestAccept } from '@/lib/domain';
import { counterAmount } from '@/lib/exchange';
import { phaseOf, sideOf } from '@/shared/ecash/mappers';
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

/**
 * Смена номера в демо-режиме. accountId выведен из телефона при входе и
 * менять его нельзя — на нём висят заявки и сессия. Поэтому новый номер
 * держим оверрайдом: аккаунт тот же, показывается новый телефон.
 */
export function demoSetPhone(accountId: string, phone: string): void {
  const prev = phoneOverrides.get(accountId);
  phoneOverrides.set(accountId, phone);

  /**
   * Пароль лежит под ключом-номером (см. passwords ниже), а при смене телефона
   * его никто не переносил — отсюда жалоба «после смены номера вход возможен
   * только по старому, по новому не выполняется». Переносим вместе с номером и
   * снимаем со старого ключа: сменив номер, входить по прежнему уже нельзя —
   * ровно как в настоящем ядре, где телефон и есть логин.
   */
  const from = prev ?? accountId.replace(/^demo-/, '');
  const saved = passwords.get(phoneKey(from));
  if (saved !== undefined && phoneKey(from) !== phoneKey(phone)) {
    passwords.set(phoneKey(phone), saved);
    passwords.delete(phoneKey(from));
  }

  /**
   * Переноса пароля мало: общий демо-пароль 'ecash2026' и вход по SMS-коду
   * логин вообще не сверяют — старый номер продолжал заходить в тот же
   * аккаунт. «Увольняем» его явно: оба login-роута проверяют demoPhoneRetired
   * и отвечают INVALID_CREDENTIALS — как настоящее ядро на несуществующий
   * логин. Новый номер из отставки убираем (могли вернуть номер обратно).
   */
  if (phoneKey(from) !== phoneKey(phone)) retiredPhones.add(phoneKey(from));
  retiredPhones.delete(phoneKey(phone));
}

/**
 * Номер, с которого «переехали» (см. demoSetPhone): входить по нему больше
 * нельзя ни с каким паролем и ни с каким SMS-кодом. Повторная регистрация
 * возвращает номер в строй (в настоящем ядре освободившийся номер тоже
 * может занять новый человек).
 */
export const demoPhoneRetired = (login: string): boolean =>
  retiredPhones.has(phoneKey(login));

export function demoUnretirePhone(phone: string): void {
  retiredPhones.delete(phoneKey(phone));
}

export function demoAccount(phone: string): Account {
  const digits = phone.replace(/\D/g, '');
  // Вход по НОВОМУ номеру должен вести в тот же аккаунт: иначе после смены
  // телефона человек логинится и попадает в пустой профиль без своих заявок
  // (в демо accountId выведен из номера — в настоящем ядре он постоянный).
  const owner = [...phoneOverrides.entries()].find(([, p]) => p.replace(/\D/g, '') === digits);
  const accountId = owner?.[0] ?? `demo-${digits}`;
  return {
    accountId,
    phoneNumber: phoneOverrides.get(accountId) ?? phone,
    isLinkedToClient: true,
    clientId: 5512,
    iin: null,
    // как и у настоящего непривязанного клиента, ФИО из ядра тут нет —
    // имя человек указывает сам при регистрации (Profile.displayName)
    firstName: '',
    lastName: '',
    middleName: '',
  };
}

type DemoDb = { requests: Map<string, ExchangeRequest[]>; nextId: number };
const g = globalThis as unknown as {
  __ecashDemo?: DemoDb;
  __ecashDemoPasswords?: Map<string, string>;
  __ecashDemoPhones?: Map<string, string>;
  __ecashDemoRetired?: Set<string>;
};
const store: DemoDb = (g.__ecashDemo ??= { requests: new Map(), nextId: 10432 });

/** accountId → показываемый номер, если его сменили (см. demoSetPhone). */
const phoneOverrides = (g.__ecashDemoPhones ??= new Map<string, string>());

/** Цифры номеров, с которых переехали, — вход по ним закрыт (demoPhoneRetired). */
const retiredPhones = (g.__ecashDemoRetired ??= new Set<string>());

/**
 * Пароли демо-аккаунтов (только ECASH_OTP_MOCK=1). Раньше вход в демо-режиме
 * сверялся с захардкоженной строкой 'ecash2026', никак не связанной с
 * паролем, который человек вводил при регистрации, — свежезарегистрированный
 * аккаунт после выхода залогинить назад было нельзя в принципе: форма всегда
 * отвечала «Неверный логин или пароль». 'ecash2026' оставлен запасным
 * вариантом для быстрого входа без регистрации — но реальный пароль теперь
 * тоже работает.
 */
const DEMO_MAGIC_PASSWORD = 'ecash2026';
const passwords = (g.__ecashDemoPasswords ??= new Map<string, string>());

const phoneKey = (phone: string) => phone.replace(/\D/g, '');

export function demoSetPassword(phone: string, password: string): void {
  passwords.set(phoneKey(phone), password);
}

export function demoCheckPassword(login: string, password: string): boolean {
  if (password === DEMO_MAGIC_PASSWORD) return true;
  const saved = passwords.get(phoneKey(login));
  return saved !== undefined && saved === password;
}

/**
 * Пауза перед «ответом казначея». 8 секунд выглядели мгновенным ответом:
 * промежуточный экран «заявка на рассмотрении» успевал мелькнуть, и
 * заказчик справедливо отметил, что курс появляется сразу — в жизни
 * казначей отвечает не мгновенно. 30 секунд дают увидеть этот шаг.
 */
export const TREASURER_DELAY_MS = 30_000;
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
      // индивидуальный курс: казначей предлагает курс чуть лучше запрошенного.
      // Сумма пересчитывается ТОЛЬКО через counterAmount: здесь стояло
      // безусловное `r.value * offered`, и заявка «1 000 000 ₸ → $»
      // показывала 541 680 000 $ вместо 1 846 $.
      const offered = Math.round(r.rate * 0.995 * 100) / 100;
      const offeredAmount = Math.round(counterAmount(r.value, offered, r.currencyFrom));
      r.accepts.push(treasurerAccept(2, offered, r.value, offeredAmount));
      r.rate = offered;
      r.amount = offeredAmount;
      r.needsClientConfirmation = true;
      // Пояснение казначея к предложению: в реальном Ecash его пишет казначей
      // (например, когда нужных купюр нет в кассе). В демо подставляем такой
      // же ответ на выбранный клиентом тип купюр — иначе поле «Комментарий
      // казначея» на карточке заявки нечем показать.
      r.acceptComment =
        r.comment === 'Мелкими купюрами'
          ? 'Мелких купюр нет — выдача крупными'
          : 'Купюры в наличии, курс подтверждаю';
      r.reservedAt = answeredAt.toISOString();
      r.reservedUntil = until;
    } else {
      r.accepts.push(treasurerAccept(1, r.rate, r.value, r.amount));
      r.status = 8;
      r.statusName = 'Забронирована';
      r.phase = 'held';
      r.acceptStatus = 2;
      r.treasurerLogin = 'kaznachey01';
      // Комментарий казначея есть и у брони, не только у индивидуального
      // курса: в реальном Ecash казначей отвечает на заказ купюр при
      // подтверждении. Без этого поле «Комментарий казначея» на карточке
      // брони в демо было всегда пустым и выглядело неработающим.
      r.acceptComment =
        r.comment === 'Мелкими купюрами'
          ? 'Мелких купюр нет — выдача крупными'
          : 'Купюры в наличии, курс подтверждаю';
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
