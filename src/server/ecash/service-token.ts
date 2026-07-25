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
  const r = await ecashFetch<AuthResponse>('/mobile/service/token', {
    method: 'POST',
    body: {
      clientId: env.ECASH_CLIENT_ID,
      clientSecret: env.ECASH_CLIENT_SECRET,
      scope: env.ECASH_SERVICE_SCOPE,
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
