import { NextResponse } from 'next/server';
import { env } from '@/server/env';
import { otpSend } from '@/server/ecash/endpoints/otp';
import { checkOrigin, rateLimited } from '@/server/api/guard';
import { body, fail, fromError, ok } from '@/server/api/respond';
import { otpSendBody } from '@/shared/schemas';
import { DEMO_OTP, demoPhoneRetired } from '@/server/demo/store';

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

  if (env.ECASH_OTP_MOCK) {
    // Вход (1) и сброс пароля (2) по сменённому номеру — «аккаунта нет»,
    // как ответило бы ядро; регистрация (0) разрешена: номер освободился.
    if (parsed.purpose !== 0 && demoPhoneRetired(parsed.phoneNumber)) {
      return fail('errors.ACCOUNT_NOT_FOUND', 404);
    }
    return ok({
      phoneNumber: parsed.phoneNumber,
      ttlSeconds: 300,
      resendAfterSeconds: 60,
      digits: 6,
      /** только в демо-режиме: код показывается в интерфейсе */
      devCode: DEMO_OTP,
    });
  }

  try {
    return ok(await otpSend(parsed.phoneNumber, parsed.purpose));
  } catch (e) {
    return fromError(e);
  }
}
