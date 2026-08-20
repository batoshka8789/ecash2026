import 'server-only';
import type { ExchangeRequest, OperationsPage } from '@/lib/domain';
import { dealAmounts } from '@/lib/exchange';
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

/**
 * Семантика сумм у ядра, ЗАДОКУМЕНТИРОВАННАЯ им самим (раздел 4.1
 * «Суммы» интеграционной документации, опубликована 19.08.2026 —
 * /api-docs/guide/Ecash-Mobile-Integration-Response.html):
 *
 *   «value — сумма в иностранной валюте, amount — сумма в тенге,
 *    rate — тенге за единицу валюты. Правило одно для обоих
 *    направлений: amount = value × rate. Привязки к currencyFrom /
 *    currencyTo здесь нет» (допуск равенства — 1%).
 *
 * Наша модель (и весь интерфейс) живёт иначе: value — что клиент ОТДАЁТ,
 * amount — что ПОЛУЧАЕТ. Для пары «отдаю тенге» поля меняются местами —
 * конвертация происходит здесь, в одном месте. Ядро с недавних пор чинит
 * перепутанные поля само, но полагаться на это не нужно: отправляем
 * сразу в его семантике.
 *
 * value/rate уходят строками (так они типизированы в Swagger — чтобы не
 * терять копейки на float), amount — числом (в схеме number/double).
 */
const toUpstreamBody = (body: ReserveBody) => {
  const kztGive = body.currencyFrom === 'KZT';
  /**
   * Валюта — целыми единицами, тенге — целым числом. Так делает и само
   * ядро («Остатка не остаётся: валюта — целыми единицами… Бэкенд срезает
   * дробный хвост и пересчитывает тенге по целой валюте»), и оно же прямо
   * рекомендует фронту считать это заранее: «округлять валюту вниз до
   * целого ещё в форме и показывать пересчитанные тенге, чтобы клиент
   * видел ровно ту сумму, что уйдёт в заявку».
   *
   * Считаем сами, а не отдаём срез на откуп ядру, именно ради этого: те
   * же числа показываются человеку в форме (dealAmounts в exchange.ts) и
   * уходят в заявку — расхождения между экраном и заявкой не возникает.
   * Оценка amount от клиента не используется: суммы выводятся из value и
   * rate. Остаток от среза остаётся у клиента: ввёл 100 000 ₸ по 462,5 —
   * сделка «216 $ за 99 900 ₸».
   */
  const { foreign, tenge } = dealAmounts(body.value, body.rate, kztGive);
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

