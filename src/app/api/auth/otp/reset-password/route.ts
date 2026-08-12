import { NextResponse } from 'next/server';
import { otpResetPassword } from '@/server/ecash/endpoints/otp';
import { checkOrigin, rateLimited } from '@/server/api/guard';
import { body, fail, fromError, ok } from '@/server/api/respond';
import { destroySession } from '@/server/session';
import { otpResetBody } from '@/shared/schemas';

/** Сброс пароля по SMS (purpose 2). Upstream отзывает все сессии аккаунта. */
export async function POST(req: Request) {
  const originErr = checkOrigin(req);
  if (originErr) return originErr;
  if (rateLimited(req, 'otp-reset', 5, 60_000)) return fail('errors.tooManyRequests', 429);

  const parsed = await body(req, otpResetBody);
  if (parsed instanceof NextResponse) return parsed;

  try {
    const reset = await otpResetPassword(parsed.phoneNumber, parsed.otp, parsed.newPassword);
    // 200 с false внутри — ядро код приняло, но пароль НЕ сменило;
    // говорить «готово» здесь значит отправить человека на неверный вход
    if (!reset) return fail('errors.INVALID_OTP', 401, { field: 'otp' });
    await destroySession();
    return ok({ reset: true });
  } catch (e) {
    return fromError(e);
  }
}
