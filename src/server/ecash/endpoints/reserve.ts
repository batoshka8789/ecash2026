import 'server-only';
import type { ExchangeRequest, OperationsPage } from '@/lib/domain';
import { counterAmount } from '@/lib/exchange';
import { ecashFetch } from '../http';
import { EcashError } from '../errors';
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
 * amount, который ПРИМЕТ сегодняшнее ядро: value × rate без ветвления по
 * направлению. Замерено 18.08.2026 живыми пробами через /mobile/reserve:
 * семантически правильный amount = value / rate (KZT → валюта, «сколько
 * клиент получит») отклоняется с 400 AMOUNT_MISMATCH, а value × rate
 * проходит валидацию в обоих направлениях (допуск у проверки есть — ±0.5
 * прошло). Это продолжение дефекта HANDOFF 9.5: ядро и пересчитывает после
 * акцепта, и валидирует на входе одним и тем же слепым умножением. Пока оно
 * так устроено, шлём то, что оно требует, — а «сколько получит» интерфейс и
 * так считает сам из value и rate (см. RequestDetail).
 */
export const upstreamAmount = (body: Pick<ReserveBody, 'value' | 'rate'>): number =>
  round2(body.value * body.rate);

/**
 * Семантически правильный amount по контракту (раздел 4.3): сумма
 * ПОЛУЧЕНИЯ в currencyTo. Уходит вторым заходом, если ядро отвергло
 * умножение, — так обход сам отключится, когда валидацию ядра починят
 * на направленную.
 */
export const contractAmount = (body: Pick<ReserveBody, 'value' | 'rate' | 'currencyFrom'>): number =>
  round2(counterAmount(body.value, body.rate, body.currencyFrom));

/**
 * value/rate в Swagger у обоих методов брони типизированы как string (в
 * примере карточки заявки тоже: "value": "1000", "rate": "512.40") — почти
 * наверняка чтобы не терять точность копеек на float. amount остаётся
 * числом (в схеме number/double). Внутри себя гоняем ReserveBody числами —
 * так удобнее и для расчётов, и для мапперов, — строкой отдаём только на
 * границе с апстримом.
 */
const toUpstreamBody = (body: ReserveBody, amount: number) => ({
  ...body,
  value: String(body.value),
  rate: String(body.rate),
  amount,
});

/**
 * Создание заявки идёт через Camunda внутри Ecash и легитимно длится
 * дольше справочников; при её сбоях ядро отвечает CAMUNDA_TIMEOUT примерно
 * на 20-й секунде (HANDOFF 9.0). Со стандартным таймаутом (8 с) человек
 * получал нашу 504 раньше настоящего вердикта ядра — а он информативнее.
 */
const CREATE_TIMEOUT_MS = 25_000;

/**
 * POST создания заявки с обходом валидации amount (см. upstreamAmount).
 * Первым уходит amount, который принимает сегодняшнее ядро (×); если оно
 * ответило AMOUNT_MISMATCH — валидацию уже починили, повторяем с amount по
 * контракту (÷ для KZT → валюта). Один повтор, без цикла.
 */
async function createWithAmountFallback(
  path: string,
  accessToken: string,
  body: ReserveBody,
): Promise<ExchangeRequest> {
  const attempt = (amount: number) =>
    ecashFetch<RawRequest>(path, {
      method: 'POST',
      token: accessToken,
      body: toUpstreamBody(body, amount),
      timeoutMs: CREATE_TIMEOUT_MS,
    });

  const first = upstreamAmount(body);
  const second = contractAmount(body);
  try {
    return mapRequest(await attempt(first));
  } catch (e) {
    if (e instanceof EcashError && e.code === 'AMOUNT_MISMATCH' && second !== first) {
      return mapRequest(await attempt(second));
    }
    throw e;
  }
}

export async function createReserve(accessToken: string, body: ReserveBody): Promise<ExchangeRequest> {
  return createWithAmountFallback('/mobile/reserve', accessToken, body);
}

export async function createIndividualRate(
  accessToken: string,
  body: ReserveBody,
): Promise<ExchangeRequest> {
  return createWithAmountFallback('/mobile/reserve/individual-rate', accessToken, body);
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
  });
  return mapRequest(raw);
}

export async function confirmIndividualRate(
  accessToken: string,
  requestId: number,
): Promise<ExchangeRequest> {
  const raw = await ecashFetch<RawRequest>(
    `/mobile/reserve/${requestId}/individual-rate/confirm`,
    { method: 'POST', token: accessToken, body: {} },
  );
  return mapRequest(raw);
}

export async function rejectIndividualRate(
  accessToken: string,
  requestId: number,
): Promise<ExchangeRequest> {
  const raw = await ecashFetch<RawRequest>(
    `/mobile/reserve/${requestId}/individual-rate/reject`,
    { method: 'POST', token: accessToken, body: {} },
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

