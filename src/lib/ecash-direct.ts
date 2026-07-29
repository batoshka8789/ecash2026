import type { BestRate, Department, DepartmentInfo, RateStat } from './domain';
import {
  mapBestRate,
  mapDepartment,
  mapDepartmentInfo,
  mapRateStat,
  type RawBest,
  type RawDep,
  type RawDepInfo,
  type RawStat,
} from '@/shared/ecash/mappers';
import { ApiError } from './api';

/**
 * Прямые запросы браузера в Ecash — публичные справочники (отделения, курсы).
 *
 * CORS у api-dev.quiq.kz открыт для нашего origin, поэтому проксировать эти
 * ответы через свой сервер незачем: минус один сетевой участок и минус
 * нагрузка на наш процесс. Замер белого списка — в README.
 *
 * Пользовательские методы (вход, бронь, кабинет) сюда НЕ переносятся: их
 * bearer живёт в зашифрованной httpOnly-куке и в JS недоступен by design.
 *
 * Сервисный токен берём у своего сервера (`/api/ecash-token`) — clientSecret
 * остаётся на сервере. Токен кэшируем в памяти вкладки и обновляем заранее.
 */

const BASE = 'https://api-dev.quiq.kz';

/** обновляем за минуту до истечения, чтобы не поймать 401 на лету */
const REFRESH_MARGIN_S = 60;

type TokenState = { token: string; expiresAt: number };

let cached: TokenState | null = null;
let inflight: Promise<string> | null = null;

async function fetchToken(): Promise<string> {
  const res = await fetch('/api/ecash-token', { cache: 'no-store' });
  if (!res.ok) throw new ApiError('errors.unknown', undefined, res.status);
  const { accessToken, expiresIn } = (await res.json()) as {
    accessToken: string;
    expiresIn: number;
  };
  cached = {
    token: accessToken,
    expiresAt: Date.now() + Math.max(0, expiresIn - REFRESH_MARGIN_S) * 1000,
  };
  return accessToken;
}

async function serviceToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) return cached.token;
  // один общий запрос на все параллельные вызовы
  inflight ??= fetchToken().finally(() => {
    inflight = null;
  });
  return inflight;
}

/**
 * Ошибки апстрима приходят в двух формах — единой доменной
 * `{ success, code, error, message }` и ASP.NET-валидации `{ errors: {...} }`.
 * Разбираем обе и отдаём тот же ApiError, что и запросы через свой BFF, —
 * вызывающий код не должен различать, откуда пришёл ответ.
 */
async function toApiError(res: Response): Promise<ApiError> {
  const body: unknown = await res.json().catch(() => null);
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    if (typeof b.error === 'string' && b.error) {
      return new ApiError(`errors.${b.error}`, undefined, res.status, b.data);
    }
    if (b.errors && typeof b.errors === 'object') {
      const field = Object.keys(b.errors as object)[0];
      return new ApiError('errors.VALIDATION', field, res.status);
    }
  }
  return new ApiError('errors.unknown', undefined, res.status);
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const run = async (token: string) =>
    fetch(`${BASE}${path}`, { headers: { authorization: `Bearer ${token}` }, signal });

  let res = await run(await serviceToken());
  if (res.status === 401) {
    // токен отозвали раньше срока — берём новый и повторяем один раз
    cached = null;
    res = await run(await serviceToken());
  }
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as T;
}

export const ecashDirect = {
  depList: async (signal?: AbortSignal): Promise<Department[]> =>
    (await get<RawDep[]>('/Department/depListApp', signal)).map(mapDepartment),

  depInfo: async (depId: number, signal?: AbortSignal): Promise<DepartmentInfo> =>
    mapDepartmentInfo(await get<RawDepInfo>(`/Department/depInfo/${depId}`, signal)),

  rates: async (depId: number, signal?: AbortSignal): Promise<RateStat[]> =>
    (await get<RawStat[]>(`/mobile/rates/statistics/${depId}`, signal)).map(mapRateStat),

  bestRate: async (currency: string, city?: string, signal?: AbortSignal): Promise<BestRate> => {
    const qs = new URLSearchParams({ currency });
    if (city) qs.set('city', city);
    return mapBestRate(await get<RawBest>(`/mobile/rates/best-rate?${qs}`, signal));
  },
};
