import { NextResponse } from 'next/server';
import { env } from '@/server/env';
import { otpResetPassword } from '@/server/ecash/endpoints/otp';
import { checkOrigin, rateLimited } from '@/server/api/guard';
import { body, fail, fromError, ok } from '@/server/api/respond';
import { destroySession } from '@/server/session';
import { otpResetBody } from '@/shared/schemas';
import { DEMO_OTP, demoPhoneRetired, demoSetPassword } from '@/server/demo/store';

/** Сброс пароля по SMS (purpose 2). Upstream отзывает все сессии аккаунта. */
export async function POST(req: Request) {
  const originErr = checkOrigin(req);
  if (originErr) return originErr;
  if (rateLimited(req, 'otp-reset', 5, 60_000)) return fail('errors.tooManyRequests', 429);

  const parsed = await body(req, otpResetBody);
  if (parsed instanceof NextResponse) return parsed;

  if (env.ECASH_OTP_MOCK) {
    if (parsed.otp !== DEMO_OTP) return fail('errors.INVALID_OTP', 401, { field: 'otp' });
    // Сменённый номер — больше не логин: «сброс» на нём заводил бы пароль
    // под ключом, по которому вход всё равно закрыт (см. demoPhoneRetired).
    if (demoPhoneRetired(parsed.phoneNumber)) {
      return fail('errors.ACCOUNT_NOT_FOUND', 404);
    }
    demoSetPassword(parsed.phoneNumber, parsed.newPassword);
    await destroySession();
    return ok({ reset: true });
  }

  try {
    await otpResetPassword(parsed.phoneNumber, parsed.otp, parsed.newPassword);
    await destroySession();
    return ok({ reset: true });
  } catch (e) {
    return fromError(e);
  }
}
