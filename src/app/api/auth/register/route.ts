import { NextResponse } from 'next/server';
import { env } from '@/server/env';
import { register } from '@/server/ecash/endpoints/auth';
import { otpConfirm } from '@/server/ecash/endpoints/otp';
import { accountMe } from '@/server/ecash/endpoints/account';
import { checkOrigin, rateLimited } from '@/server/api/guard';
import { body, fail, fromError, ok } from '@/server/api/respond';
import { createSession, sessionFromTokens } from '@/server/session';
import { registerBody } from '@/shared/schemas';
import { DEMO_OTP, DEMO_TOKEN, demoAccount } from '@/server/demo/store';
import { logAuthTokens, logDemoTokens } from '@/server/ecash/token-log';

/** Регистрация: телефон подтверждён OTP (purpose 0) → пароль → сессия. */
export async function POST(req: Request) {
  const originErr = checkOrigin(req);
  if (originErr) return originErr;
  if (rateLimited(req, 'register', 5, 60_000)) return fail('errors.tooManyRequests', 429);

  const parsed = await body(req, registerBody);
  if (parsed instanceof NextResponse) return parsed;

  if (env.ECASH_OTP_MOCK) {
    if (parsed.otp !== DEMO_OTP) return fail('errors.INVALID_OTP', 401, { field: 'otp' });
    const account = demoAccount(parsed.phoneNumber);
    logDemoTokens('register', DEMO_TOKEN);
    await createSession({
      accessToken: DEMO_TOKEN,
      refreshToken: DEMO_TOKEN,
      accessExpiresAt: Date.now() + 3600_000 * 24,
      accountId: account.accountId,
    });
    return ok({ account }, { status: 201 });
  }

  try {
    // подтверждаем код; upstream гасит его после успешной проверки
    const confirm = await otpConfirm(parsed.phoneNumber, parsed.otp, 0);
    if (!confirm.isConfirmed) return fail('errors.INVALID_OTP', 401, { field: 'otp' });

    const tokens = await register(parsed.phoneNumber, parsed.password, parsed.iin);
    // Печать в консоль сервера: до браузера токен не доходит, он уезжает
    // в зашифрованную httpOnly-куку. Только dev — см. token-log.ts.
    logAuthTokens('register', tokens);
    const account = await accountMe(tokens.accessToken);
    await createSession(sessionFromTokens(tokens, account.accountId));
    return ok({ account }, { status: 201 });
  } catch (e) {
    return fromError(e);
  }
}
