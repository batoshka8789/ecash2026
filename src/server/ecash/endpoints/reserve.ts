import 'server-only';
import type { ExchangeRequest, OperationsPage } from '@/lib/domain';
import { ecashFetch } from '../http';
import { mapOperationsPage, mapRequest, type RawRequest } from '@/shared/ecash/mappers';

/**
 * Брони и операции. Владелец заявки — accountId из токена;
 * clientId / телефон / ИИН НЕ передаются: бэкенд подставляет их из аккаунта.
 */

export type ReserveBody = {
  currencyFrom: string;
  currencyTo: string;
  value: number;
  rate: number;
  amount: number;
  depId?: number;
  kassaId?: number;
  fullName?: string;
  comment?: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Семантика сумм у ядра НЕ совпадает с нашей доменной моделью, и это
 * сказано текстом его собственной ошибки (AMOUNT_MISMATCH, живой замер
 * 19.08.2026): «amount (сумма в тенге) должна равняться value × rate.
 * value — сумма в валюте (не в тенге)». То есть у ядра:
 *
 *   value  — сумма в ИНОСТРАННОЙ валюте, независимо от направления пары;
 *   amount — сумма в ТЕНГЕ, независимо от направления пары;
 *   всегда amount = value × rate (допуск в несколько тенге — проба
 *   190.70 × 524.4 = 100 003,08 при amount 100 000 прошла).
 *
 * Наша модель (и весь интерфейс) живёт иначе: value — что клиент ОТДАЁТ,
 * amount — что ПОЛУЧАЕТ. Для пары «отдаю тенге» поля меняются местами, и
 * прежний код слал тенге в поле валюты — ядро читало «100 000 долларов»
 * (искажённые этим заявки №6729, 6735, 6763–6765 отменены). Конвертация
 * в семантику ядра происходит здесь, в одном месте.
 *
 * value/rate уходят строками (так они типизированы в Swagger — чтобы не
 * терять копейки на float), amount — числом (в схеме number/double).
 */
const toUpstreamBody = (body: ReserveBody) => {
  const kztGive = body.currencyFrom === 'KZT';
  /**
   * Суммы сделки — целые, по требованию заказчика и по природе обменника:
   * выдаются купюры и целые тенге, а не «216,22 $» (то же правило уже
   * действует в отображении — см. formatMoney). Обе суммы выводятся из
   * value + rate, оценка amount от клиента не используется.
   *
   * KZT → валюта: клиент получает ЦЕЛЫЕ единицы валюты — floor, чтобы не
   * обещать больше, чем оплачено (216,7 $ расчётных — это всё равно 216 $
   * на руки). Тенге сделки — ровно цена этих целых единиц: пара чисел
   * сходится с тождеством ядра amount = value × rate (его допуск мал —
   * ±3 ₸ проходило, а разрыв «клиентские 100 000 против 216 × 462,5»
   * почти с целый курс). Разница с введённой суммой остаётся у клиента:
   * ввёл 100 000 ₸ — сделка «216 $ за 99 900 ₸».
   *
   * Валюта → KZT: клиент отдаёт свои купюры как ввёл, получает целые
   * тенге (20 × 466,71 = 9334,2 → 9334; полтенге в кассе не существует).
   * +1e-9 к floor гасит двоичную пыль плавающей точки (216,(9) ≠ 217).
   */
  const foreign = kztGive ? Math.floor(body.value / body.rate + 1e-9) : round2(body.value);
  const tenge = Math.round((kztGive ? foreign : body.value) * body.rate);
  return {
    ...body,
    value: String(foreign),
    rate: String(body.rate),
    amount: tenge,
  };
};

/**
 * Создание заявки идёт через Camunda внутри Ecash и легитимно длится
 * дольше справочников; при её сбоях ядро отвечает CAMUNDA_TIMEOUT примерно
 * на 20-й секунде (HANDOFF 9.0). Со стандартным таймаутом (8 с) человек
 * получал нашу 504 раньше настоящего вердикта ядра — а он информативнее.
 */
const CREATE_TIMEOUT_MS = 25_000;

const create = async (path: string, accessToken: string, body: ReserveBody) =>
  mapRequest(
    await ecashFetch<RawRequest>(path, {
      method: 'POST',
      token: accessToken,
      body: toUpstreamBody(body),
      timeoutMs: CREATE_TIMEOUT_MS,
      // создание заявки — открытый блокер на стороне Ecash (HANDOFF §9.0):
      // их разработчикам нужен буквальный JSON обмена, а не пересказ
      trace: true,
    }),
  );

export async function createReserve(accessToken: string, body: ReserveBody): Promise<ExchangeRequest> {
  return create('/mobile/reserve', accessToken, body);
}

export async function createIndividualRate(
  accessToken: string,
  body: ReserveBody,
): Promise<ExchangeRequest> {
  return create('/mobile/reserve/individual-rate', accessToken, body);
}

export async function getRequest(accessToken: string, requestId: number): Promise<ExchangeRequest> {
  const raw = await ecashFetch<RawRequest>(`/mobile/reserve/${requestId}`, { token: accessToken });
  return mapRequest(raw);
}

export async function cancelRequest(
  accessToken: string,
  requestId: number,
  comment?: string,
): Promise<ExchangeRequest> {
  const raw = await ecashFetch<RawRequest>(`/mobile/reserve/${requestId}/cancel`, {
    method: 'POST',
    token: accessToken,
    body: comment ? { comment } : {},
    trace: true,
  });
  return mapRequest(raw);
}

export async function confirmIndividualRate(
  accessToken: string,
  requestId: number,
): Promise<ExchangeRequest> {
  const raw = await ecashFetch<RawRequest>(
    `/mobile/reserve/${requestId}/individual-rate/confirm`,
    { method: 'POST', token: accessToken, body: {}, trace: true },
  );
  return mapRequest(raw);
}

export async function rejectIndividualRate(
  accessToken: string,
  requestId: number,
): Promise<ExchangeRequest> {
  const raw = await ecashFetch<RawRequest>(
    `/mobile/reserve/${requestId}/individual-rate/reject`,
    { method: 'POST', token: accessToken, body: {}, trace: true },
  );
  return mapRequest(raw);
}

export async function listOperations(
  accessToken: string,
  page = 1,
  pageSize = 20,
): Promise<OperationsPage> {
  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const raw = await ecashFetch<unknown>(`/mobile/operations?${qs}`, { token: accessToken });
  return mapOperationsPage(raw as Parameters<typeof mapOperationsPage>[0]);
}

