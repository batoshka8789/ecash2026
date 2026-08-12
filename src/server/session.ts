import 'server-only';

import { cookies } from 'next/headers';
import { EcashError } from './ecash/errors';
import { refreshTokens, type AuthTokens } from './ecash/endpoints/auth';
import { seal, unseal } from './session-crypto';
import { isAdminPhone } from './admin';

/**
 * Сессия = зашифрованная httpOnly-кука с токенами Ecash. Ничего не хранится
 * в памяти процесса: переживает рестарт и работает при нескольких инстансах.
 *
 * Ограничение Next: Server Component не может ставить куки, поэтому запись
 * (createSession / ротация) происходит только в route handlers.
 */

const COOKIE = 'ecash_s';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 дней; не длиннее жизни refresh-токена Ecash

export type SessionData = {
  accessToken: string;
  refreshToken: string;
  /** epoch ms истечения accessToken (с запасом 30 с) */
  accessExpiresAt: number;
  accountId: string;
  /**
   * Телефон аккаунта. Нужен гарду раздела /admin в Server Component, где
   * нельзя ни ходить в сеть, ни ротировать куку. Это кеш ЛИЧНОСТИ, а не прав:
   * решение принимается заново при каждой проверке (src/server/admin.ts).
   */
  phone?: string;
};

const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  maxAge: MAX_AGE,
  secure: process.env.NODE_ENV === 'production',
} as const;

export function sessionFromTokens(
  tokens: AuthTokens,
  accountId: string,
  phone = '',
): SessionData {
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessExpiresAt: Date.now() + tokens.expiresIn * 1000 - 30_000,
    accountId,
    phone,
  };
}

/** Пишет сессию в куку. Только из route handlers. */
export async function createSession(data: SessionData): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, await seal(data), cookieOpts);
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** Читает сессию без обращений к сети. null: куки нет или не расшифровалась. */
export async function readSession(): Promise<SessionData | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  return unseal<SessionData>(raw);
}

/**
 * Пользовательский accessToken для вызова upstream. При истёкшем access —
 * прозрачный refresh с ротацией куки (поэтому только в route handlers).
 * null = не авторизован; кука чистится, если refresh отклонён.
 */
export async function userToken(): Promise<string | null> {
  const s = await readSession();
  if (!s) return null;
  if (s.accessExpiresAt > Date.now()) return s.accessToken;

  try {
    const fresh = await refreshTokens(s.refreshToken);
    const next = sessionFromTokens(fresh, s.accountId, s.phone ?? '');
    await createSession(next);
    return next.accessToken;
  } catch (e) {
    if (e instanceof EcashError && (e.httpStatus === 401 || e.httpStatus === 400)) {
      await destroySession();
      return null;
    }
    throw e; // сеть/5xx — не выкидывать пользователя из-за сбоя upstream
  }
}

/**
 * Лёгкая проверка авторизации для Server Components (без записи кук).
 * Достаточно для ветвления лендинг/приложение и гарда кабинета.
 */
export async function isAuthenticated(): Promise<boolean> {
  return (await readSession()) !== null;
}

/** accountId текущей сессии, null для гостя. */
export async function sessionAccountId(): Promise<string | null> {
  return (await readSession())?.accountId ?? null;
}

/**
 * Права админа для Server Components: без сети и без записи кук — там нельзя
 * ни то, ни другое. Телефон берётся из запечатанной куки (подделать её без
 * SESSION_SECRET нельзя), решение — по актуальному ADMIN_PHONES.
 *
 * Это только для того, чтобы не рисовать страницу. Настоящая, авторитетная
 * проверка — `withAdmin` на каждом запросе к API: там номер берётся из живого
 * ответа `/mobile/account/me`, а не из куки, поэтому отозванные права
 * закрывают доступ к данным немедленно. Нарисованный без прав экран сам по
 * себе данных не даёт.
 *
 * Старые куки без `phone` дадут false — админ один раз перелогинится, и это
 * правильное поведение по умолчанию.
 */
export async function sessionIsAdmin(): Promise<boolean> {
  const phone = (await readSession())?.phone;
  return phone ? isAdminPhone(phone) : false;
}
