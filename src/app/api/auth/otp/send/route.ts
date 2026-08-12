import { NextResponse } from 'next/server';
import { otpSend } from '@/server/ecash/endpoints/otp';
import { checkOrigin, rateLimited } from '@/server/api/guard';
import { body, fail, fromError, ok } from '@/server/api/respond';
import { otpSendBody } from '@/shared/schemas';

/**
 * Отправка SMS-кода. Свой rate-limit ПЕРЕД upstream: OTP_COOLDOWN у Ecash
 * действует на телефон, а мы дополнительно режем по IP —
 * иначе наш эндпоинт можно использовать как усилитель SMS-затрат.
 */
export async function POST(req: Request) {
  const originErr = checkOrigin(req);
  if (originErr) return originErr;
  if (rateLimited(req, 'otp-send', 3, 60_000)) return fail('errors.OTP_COOLDOWN', 429);

  const parsed = await body(req, otpSendBody);
  if (parsed instanceof NextResponse) return parsed;

  try {
    return ok(await otpSend(parsed.phoneNumber, parsed.purpose));
  } catch (e) {
    return fromError(e);
  }
}
