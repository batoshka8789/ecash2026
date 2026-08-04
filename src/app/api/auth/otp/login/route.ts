import { NextResponse } from 'next/server';
import { env } from '@/server/env';
import { otpLogin } from '@/server/ecash/endpoints/otp';
import { accountMe } from '@/server/ecash/endpoints/account';
import { checkOrigin, rateLimited } from '@/server/api/guard';
import { body, fail, fromError, ok } from '@/server/api/respond';
import { createSession, sessionFromTokens } from '@/server/session';
import { otpLoginBody } from '@/shared/schemas';
import { DEMO_OTP, DEMO_TOKEN, demoAccount, demoPhoneRetired } from '@/server/demo/store';

/** Вход по SMS-коду (purpose 1). */
export async function POST(req: Request) {
  const originErr = checkOrigin(req);
  if (originErr) return originErr;
  if (rateLimited(req, 'otp-login', 10, 60_000)) return fail('errors.tooManyRequests', 429);

  const parsed = await body(req, otpLoginBody);
  if (parsed instanceof NextResponse) return parsed;

  if (env.ECASH_OTP_MOCK) {
    if (parsed.otp !== DEMO_OTP) return fail('errors.INVALID_OTP', 401, { field: 'otp' });
    // Старый (сменённый) номер не пускаем и по SMS-коду — вход по нему
    // вёл бы в тот же аккаунт в обход смены логина (см. demoSetPhone).
    if (demoPhoneRetired(parsed.phoneNumber)) {
      return fail('errors.ACCOUNT_NOT_FOUND', 404);
    }
    const account = demoAccount(parsed.phoneNumber);
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
    const tokens = await otpLogin(parsed.phoneNumber, parsed.otp, parsed.deviceId);
    const account = await accountMe(tokens.accessToken);
    await createSession(sessionFromTokens(tokens, account.accountId, account.phoneNumber));
    return ok({ account });
  } catch (e) {
    return fromError(e);
  }
}
