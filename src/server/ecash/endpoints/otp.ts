import 'server-only';
import { toAuthTokens, type AuthTokens } from './auth';
import { ecashFetch } from '../http';

/**
 * OTP по SMS. Все методы без токена. Purpose: 0 регистрация · 1 вход · 2 сброс пароля.
 * Код 6 цифр, TTL 300 с, повтор не чаще 60 с (OTP_COOLDOWN).
 */

export type OtpPurpose = 0 | 1 | 2;

export type OtpSendResult = {
  phoneNumber: string;
  ttlSeconds: number;
  resendAfterSeconds: number;
  digits: number;
};

export const otpSend = (phoneNumber: string, purpose: OtpPurpose) =>
  ecashFetch<OtpSendResult>('/mobile/otp/send', {
    method: 'POST',
    body: { phoneNumber, purpose },
  });

export const otpConfirm = (phoneNumber: string, otp: string, purpose: OtpPurpose) =>
  ecashFetch<{ phoneNumber: string; isConfirmed: boolean }>('/mobile/otp/confirm', {
    method: 'POST',
    body: { phoneNumber, otp, purpose },
  });

/** Вход по SMS-коду — ответ той же формы, что у /mobile/auth/login (поле `token`). */
export const otpLogin = async (
  phoneNumber: string,
  otp: string,
  deviceId?: string,
): Promise<AuthTokens> =>
  toAuthTokens(
    await ecashFetch<unknown>('/mobile/otp/login', {
      method: 'POST',
      body: { phoneNumber, otp, ...(deviceId ? { deviceId } : {}) },
    }),
  );

/**
 * Сбрасывает пароль и отзывает все сессии аккаунта.
 *
 * Форма успешного тела в Swagger не описана (как и у остальных 28 операций),
 * а http.ts честно предупреждает: часть ручек отвечает literal true / пустым
 * телом, часть — конвертом {success, data}. Поэтому 200 сам по себе ещё не
 * значит «пароль изменён»: явный false в любом из известных мест считаем
 * отказом. Раньше тело игнорировалось целиком, и роут отвечал «reset: true»
 * на любой 200 — человек видел «пароль изменён», а вход со «сменённым»
 * паролем получал INVALID_CREDENTIALS.
 */
export const otpResetPassword = async (
  phoneNumber: string,
  otp: string,
  newPassword: string,
): Promise<boolean> => {
  const res = await ecashFetch<unknown>('/mobile/otp/reset-password', {
    method: 'POST',
    body: { phoneNumber, otp, newPassword },
  });
  if (res === false) return false;
  if (typeof res === 'object' && res !== null) {
    const r = res as { success?: unknown; data?: unknown; isConfirmed?: unknown };
    if (r.success === false || r.data === false || r.isConfirmed === false) return false;
  }
  // тело сброса не содержит ПДн — фиксируем форму, чтобы диагностика
  // «200, но пароль не подошёл» не требовала гаданий
  console.warn('[ecash] reset-password 200, тело:', JSON.stringify(res));
  return true;
};
