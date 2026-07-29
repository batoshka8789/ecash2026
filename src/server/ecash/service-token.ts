import 'server-only';
import { env } from '@/server/env';
import { ecashFetch } from './http';

/**
 * Сервисный токен (публичные справочники: отделения, курсы).
 * Кэш в globalThis переживает HMR — тот же приём, что у мок-БД раньше.
 * Одна in-flight-промис-ссылка: параллельные запросы не устраивают «стадо».
 */

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
};

type TokenState = {
  accessToken: string;
  refreshToken: string;
  /** epoch ms, с запасом 60 с до реального истечения */
  expiresAt: number;
};

type Cache = {
  state: TokenState | null;
  inflight: Promise<TokenState> | null;
};

const g = globalThis as unknown as { __ecashServiceToken?: Cache };
const cache: Cache = (g.__ecashServiceToken ??= { state: null, inflight: null });

const MARGIN_MS = 60_000;

async function issue(): Promise<TokenState> {
  // Тело — ровно clientId + clientSecret: ServiceTokenRequest в Swagger объявлен
  // с additionalProperties: false, а scope сервер проставляет сам (в выданном
  // JWT приходит claim scope=mobile-service). Раньше мы слали его в теле —
  // сервер поле игнорировал, проверено запросом с ним и без него.
  const r = await ecashFetch<AuthResponse>('/mobile/service/token', {
    method: 'POST',
    body: {
      clientId: env.ECASH_CLIENT_ID,
      clientSecret: env.ECASH_CLIENT_SECRET,
    },
  });
  return {
    accessToken: r.accessToken,
    refreshToken: r.refreshToken,
    expiresAt: Date.now() + r.expiresIn * 1000 - MARGIN_MS,
  };
}

async function refresh(state: TokenState): Promise<TokenState> {
  try {
    const r = await ecashFetch<AuthResponse>('/mobile/service/refresh', {
      method: 'POST',
      body: { refreshToken: state.refreshToken },
    });
    return {
      accessToken: r.accessToken,
      refreshToken: r.refreshToken,
      expiresAt: Date.now() + r.expiresIn * 1000 - MARGIN_MS,
    };
  } catch {
    // refresh истёк/отозван — полный re-issue по clientId+clientSecret
    return issue();
  }
}

export async function getServiceToken(): Promise<string> {
  if (cache.state && cache.state.expiresAt > Date.now()) {
    return cache.state.accessToken;
  }
  if (!cache.inflight) {
    cache.inflight = (cache.state ? refresh(cache.state) : issue())
      .then((s) => {
        cache.state = s;
        return s;
      })
      .finally(() => {
        cache.inflight = null;
      });
  }
  const s = await cache.inflight;
  return s.accessToken;
}

/** Сброс кэша (после 401 от справочника — токен мог быть отозван). */
export function invalidateServiceToken(): void {
  cache.state = null;
}

/**
 * Сколько секунд токену осталось жить — браузеру, чтобы он знал, когда
 * просить следующий, и не ловил 401 посреди работы. Уже с запасом MARGIN_MS,
 * заложенным при выдаче; на всякий случай не отдаём отрицательное.
 */
export function serviceTokenExpiresIn(): number {
  if (!cache.state) return 0;
  return Math.max(0, Math.floor((cache.state.expiresAt - Date.now()) / 1000));
}
