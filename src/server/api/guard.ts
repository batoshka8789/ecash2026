import 'server-only';
import { NextResponse } from 'next/server';
import type { Account } from '@/lib/domain';
import { env } from '@/server/env';
import { userToken } from '@/server/session';
import { currentAccount } from '@/server/account';
import { isAdminAccount } from '@/server/admin';
import { fail } from './respond';

/**
 * Периметр BFF: same-origin для изменяющих методов + rate-limit.
 * In-memory лимитер корректен для одного Node-инстанса (наш хостинг);
 * при горизонтальном масштабировании заменить на Redis.
 */

// --------------------------------------------------------------- same-origin

export function checkOrigin(req: Request): NextResponse | null {
  if (req.method === 'GET' || req.method === 'HEAD') return null;

  // современные браузеры шлют Sec-Fetch-Site; curl/сервер-сервер — нет
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') {
    return fail('errors.forbiddenOrigin', 403);
  }
  const origin = req.headers.get('origin');
  if (origin && origin !== env.APP_ORIGIN) {
    return fail('errors.forbiddenOrigin', 403);
  }
  return null;
}

// ---------------------------------------------------------------- rate limit

type Bucket = { count: number; resetAt: number };
const g = globalThis as unknown as { __ecashRl?: Map<string, Bucket> };
const buckets = (g.__ecashRl ??= new Map());

/** true = лимит превышен. Окно скользящее по бакетам фиксированной ширины. */
export function rateLimited(req: Request, key: string, limit: number, windowMs: number): boolean {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'local';
  const bucketKey = `${key}:${ip}`;
  const now = Date.now();
  const b = buckets.get(bucketKey);
  if (!b || b.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    // попутная уборка, чтобы Map не росла бесконечно
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return false;
  }
  b.count += 1;
  return b.count > limit;
}

// -------------------------------------------------------------------- авторизация

/**
 * Обёртка пользовательских роутов: same-origin, токен (с прозрачным
 * refresh и ротацией куки), 401 без валидной сессии.
 */
export function withUser(
  handler: (req: Request, token: string, ctx: { params: Promise<Record<string, string>> }) => Promise<NextResponse>,
) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    const originErr = checkOrigin(req);
    if (originErr) return originErr;
    const token = await userToken();
    if (!token) return fail('errors.unauthorized', 401);
    return handler(req, token, ctx);
  };
}

/**
 * Обёртка админских роутов. Это АВТОРИТЕТНАЯ проверка прав: телефон берётся
 * из актуального аккаунта, а не из куки, поэтому 30-дневная сессия сама по
 * себе прав не даёт. Гард страниц (sessionIsAdmin) лишь не рисует экран.
 *
 * Не-админу отвечаем 404, а не 403: существование раздела не подтверждаем.
 */
export function withAdmin(
  handler: (
    req: Request,
    token: string,
    ctx: { params: Promise<Record<string, string>>; account: Account },
  ) => Promise<NextResponse>,
) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    const originErr = checkOrigin(req);
    if (originErr) return originErr;
    const token = await userToken();
    if (!token) return fail('errors.unauthorized', 401);
    const account = await currentAccount();
    if (!account) return fail('errors.unauthorized', 401);
    if (!isAdminAccount(account)) return fail('errors.notFound', 404);
    return handler(req, token, { ...ctx, account });
  };
}
