import 'server-only';
import type { ExchangeRequest, OperationsPage } from '@/lib/domain';
import { ecashFetch } from '../http';
import { mapOperationsPage, mapRequest, type RawRequest } from '../mappers';

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

export async function createReserve(
  accessToken: string,
  body: ReserveBody,
): Promise<ExchangeRequest> {
  const raw = await ecashFetch<RawRequest>('/mobile/reserve', {
    method: 'POST',
    token: accessToken,
    body,
  });
  return mapRequest(raw);
}

export async function createIndividualRate(
  accessToken: string,
  body: ReserveBody,
): Promise<ExchangeRequest> {
  const raw = await ecashFetch<RawRequest>('/mobile/reserve/individual-rate', {
    method: 'POST',
    token: accessToken,
    body,
  });
  return mapRequest(raw);
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
  const raw = await ecashFetch<RawRequest>(`/mobile/reserve/${requestId}/individual-rate/confirm`, {
    method: 'POST',
    token: accessToken,
    body: {},
  });
  return mapRequest(raw);
}

export async function rejectIndividualRate(
  accessToken: string,
  requestId: number,
): Promise<ExchangeRequest> {
  const raw = await ecashFetch<RawRequest>(`/mobile/reserve/${requestId}/individual-rate/reject`, {
    method: 'POST',
    token: accessToken,
    body: {},
  });
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

export async function getOperation(
  accessToken: string,
  requestId: number,
): Promise<ExchangeRequest> {
  const raw = await ecashFetch<RawRequest>(`/mobile/operations/${requestId}`, {
    token: accessToken,
  });
  return mapRequest(raw);
}
