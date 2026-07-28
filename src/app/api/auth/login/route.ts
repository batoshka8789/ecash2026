import { NextResponse } from 'next/server';
import { env } from '@/server/env';
import { login } from '@/server/ecash/endpoints/auth';
import { accountMe } from '@/server/ecash/endpoints/account';
import { checkOrigin, rateLimited } from '@/server/api/guard';
import { body, fail, fromError, ok } from '@/server/api/respond';
import { createSession, sessionFromTokens } from '@/server/session';
import { loginBody } from '@/shared/schemas';
import { DEMO_TOKEN, demoAccount } from '@/server/demo/store';
import { logAuthTokens, logDemoTokens } from '@/server/ecash/token-log';

/** Вход: телефон или ИИН + пароль. */
export async function POST(req: Request) {
  const originErr = checkOrigin(req);
  if (originErr) return originErr;
  if (rateLimited(req, 'login', 10, 60_000)) return fail('errors.tooManyRequests', 429);

  const parsed = await body(req, loginBody);
  if (parsed instanceof NextResponse) return parsed;

  // демо-режим: фиксированный пароль, аккаунт не ходит в upstream
  if (env.ECASH_OTP_MOCK && parsed.password === 'ecash2026') {
    const account = demoAccount(parsed.login);
    logDemoTokens('login', DEMO_TOKEN);
    await createSession({
      accessToken: DEMO_TOKEN,
      refreshToken: DEMO_TOKEN,
      accessExpiresAt: Date.now() + 3600_000 * 24,
      accountId: account.accountId,
    });
    return ok({ account });
  }

  try {
    const tokens = await login(parsed.login, parsed.password);
    logAuthTokens('login', tokens);
    const account = await accountMe(tokens.accessToken);
    await createSession(sessionFromTokens(tokens, account.accountId));
    return ok({ account });
  } catch (e) {
    return fromError(e);
  }
}
