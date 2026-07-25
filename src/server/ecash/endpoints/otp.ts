import 'server-only';
import type { AuthTokens } from './auth';
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

export const otpLogin = (phoneNumber: string, otp: string, deviceId?: string) =>
  ecashFetch<AuthTokens>('/mobile/otp/login', {
    method: 'POST',
    body: { phoneNumber, otp, ...(deviceId ? { deviceId } : {}) },
  });

/** Сбрасывает пароль и отзывает все сессии аккаунта. */
export const otpResetPassword = (phoneNumber: string, otp: string, newPassword: string) =>
  ecashFetch<boolean>('/mobile/otp/reset-password', {
    method: 'POST',
    body: { phoneNumber, otp, newPassword },
  });
