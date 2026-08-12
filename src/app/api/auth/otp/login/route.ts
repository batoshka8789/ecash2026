import { NextResponse } from 'next/server';
import { otpLogin } from '@/server/ecash/endpoints/otp';
import { accountMe } from '@/server/ecash/endpoints/account';
import { checkOrigin, rateLimited } from '@/server/api/guard';
import { body, fail, fromError, ok } from '@/server/api/respond';
import { createSession, sessionFromTokens } from '@/server/session';
import { otpLoginBody } from '@/shared/schemas';

/** Вход по SMS-коду (purpose 1). */
export async function POST(req: Request) {
  const originErr = checkOrigin(req);
  if (originErr) return originErr;
  if (rateLimited(req, 'otp-login', 10, 60_000)) return fail('errors.tooManyRequests', 429);

  const parsed = await body(req, otpLoginBody);
  if (parsed instanceof NextResponse) return parsed;

  try {
    const tokens = await otpLogin(parsed.phoneNumber, parsed.otp, parsed.deviceId);
    const account = await accountMe(tokens.accessToken);
    await createSession(sessionFromTokens(tokens, account.accountId, account.phoneNumber));
    return ok({ account });
  } catch (e) {
    return fromError(e);
  }
}
