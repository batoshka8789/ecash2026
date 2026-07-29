import { NextResponse } from 'next/server';
import { env } from '@/server/env';
import { login } from '@/server/ecash/endpoints/auth';
import { accountMe } from '@/server/ecash/endpoints/account';
import { checkOrigin, rateLimited } from '@/server/api/guard';
import { body, fail, fromError, ok } from '@/server/api/respond';
import { createSession, sessionFromTokens } from '@/server/session';
import { loginBody } from '@/shared/schemas';
import { DEMO_TOKEN, demoAccount, demoCheckPassword } from '@/server/demo/store';

/** Вход: телефон или ИИН + пароль. */
export async function POST(req: Request) {
  const originErr = checkOrigin(req);
  if (originErr) return originErr;
  if (rateLimited(req, 'login', 10, 60_000)) return fail('errors.tooManyRequests', 429);

  const parsed = await body(req, loginBody);
  if (parsed instanceof NextResponse) return parsed;

  // демо-режим: свой пароль с регистрации (плюс запасной 'ecash2026'),
  // аккаунт не ходит в upstream
  if (env.ECASH_OTP_MOCK && demoCheckPassword(parsed.login, parsed.password)) {
    const account = demoAccount(parsed.login);
    await createSession({
      accessToken: DEMO_TOKEN,
      refreshToken: DEMO_TOKEN,
      accessExpiresAt: Date.now() + 3600_000 * 24,
      accountId: account.accountId,
      phone: account.phoneNumber,
    });
    return ok({ account });
  }

  try {
    const tokens = await login(parsed.login, parsed.password);
    const account = await accountMe(tokens.accessToken);
    await createSession(sessionFromTokens(tokens, account.accountId, account.phoneNumber));
    return ok({ account });
  } catch (e) {
    return fromError(e);
  }
}
