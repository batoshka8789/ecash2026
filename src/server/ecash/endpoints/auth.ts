import 'server-only';
import { ecashFetch } from '../http';

/**
 * Пользовательская аутентификация. Login — телефон или ИИН
 * (телефон нормализуется на бэкенде, формат любой).
 */

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
};

/**
 * Пользовательские методы отдают токен НЕ так, как сервисный.
 *
 * `/mobile/service/token` → { accessToken, refreshToken, expiresIn, tokenType }
 * `/mobile/auth/login`    → { token, refreshToken, accountId, phoneNumber,
 *                             email, clientId, isLinkedToClient, lastLogin }
 *
 * То есть поле называется `token`, а срока жизни в ответе нет вовсе. Раньше мы
 * читали `accessToken` у обоих, у входа получали undefined и отправляли дальше
 * заголовок «Bearer undefined» — апстрим отвечал 401 INVALID_TOKEN сразу после
 * успешного входа, и пользователю показывалось «неверный пароль».
 *
 * Схем ответов в Swagger нет (у всех 28 операций описан только код 200), так
 * что читаем оба имени: если Ecash когда-нибудь выровняет формат, ничего не
 * сломается. Срок жизни берём из клейма `exp` самого JWT, а если его нет —
 * час, как у сервисного токена.
 */
const FALLBACK_TTL_S = 3600;

function jwtTtlSeconds(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const pad = parts[1] + '='.repeat((4 - (parts[1].length % 4)) % 4);
    const payload = JSON.parse(
      Buffer.from(pad.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    ) as { exp?: unknown };
    if (typeof payload.exp !== 'number') return null;
    const ttl = payload.exp - Math.floor(Date.now() / 1000);
    return ttl > 0 ? ttl : null;
  } catch {
    return null;
  }
}

export function toAuthTokens(raw: unknown): AuthTokens {
  const r = (raw ?? {}) as Record<string, unknown>;
  const access = typeof r.accessToken === 'string' ? r.accessToken : r.token;
  if (typeof access !== 'string' || !access) {
    throw new Error('Ecash: в ответе входа нет токена (ни accessToken, ни token)');
  }
  return {
    accessToken: access,
    refreshToken: typeof r.refreshToken === 'string' ? r.refreshToken : '',
    expiresIn:
      typeof r.expiresIn === 'number' ? r.expiresIn : (jwtTtlSeconds(access) ?? FALLBACK_TTL_S),
    tokenType: typeof r.tokenType === 'string' ? r.tokenType : 'Bearer',
  };
}

export const login = async (loginValue: string, password: string) =>
  toAuthTokens(
    await ecashFetch<unknown>('/mobile/auth/login', {
      method: 'POST',
      body: { login: loginValue, password },
    }),
  );

export const register = async (phoneNumber: string, password: string, iin?: string) =>
  toAuthTokens(
    await ecashFetch<unknown>('/mobile/auth/register', {
      method: 'POST',
      body: { phoneNumber, password, ...(iin ? { iin } : {}) },
    }),
  );

export const refreshTokens = async (refreshToken: string) =>
  toAuthTokens(
    await ecashFetch<unknown>('/mobile/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    }),
  );

export const logout = (accessToken: string) =>
  ecashFetch<void>('/mobile/auth/logout', { method: 'POST', token: accessToken, body: {} });
