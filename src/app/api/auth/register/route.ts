import { NextResponse } from 'next/server';
import { register } from '@/server/ecash/endpoints/auth';
import { otpConfirm } from '@/server/ecash/endpoints/otp';
import { accountMe } from '@/server/ecash/endpoints/account';
import { checkOrigin, rateLimited } from '@/server/api/guard';
import { body, fail, fromError, ok } from '@/server/api/respond';
import { createSession, sessionFromTokens } from '@/server/session';
import { registerBody } from '@/shared/schemas';

/** Регистрация: телефон подтверждён OTP (purpose 0) → пароль → сессия. */
export async function POST(req: Request) {
  const originErr = checkOrigin(req);
  if (originErr) return originErr;
  if (rateLimited(req, 'register', 5, 60_000)) return fail('errors.tooManyRequests', 429);

  const parsed = await body(req, registerBody);
  if (parsed instanceof NextResponse) return parsed;

  try {
    // подтверждаем код; upstream гасит его после успешной проверки
    const confirm = await otpConfirm(parsed.phoneNumber, parsed.otp, 0);
    if (!confirm.isConfirmed) return fail('errors.INVALID_OTP', 401, { field: 'otp' });

    const tokens = await register(parsed.phoneNumber, parsed.password, parsed.iin);
    const account = await accountMe(tokens.accessToken);
    await createSession(sessionFromTokens(tokens, account.accountId, account.phoneNumber));
    return ok({ account }, { status: 201 });
  } catch (e) {
    return fromError(e);
  }
}
