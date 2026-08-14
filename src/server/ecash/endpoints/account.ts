import 'server-only';
import type { Account } from '@/lib/domain';
import { ecashFetch } from '../http';
import { mapAccount } from '@/shared/ecash/mappers';

/** Методы в контексте пользователя — только с пользовательским токеном. */

export async function accountMe(accessToken: string): Promise<Account> {
  const raw = await ecashFetch<unknown>('/mobile/account/me', { token: accessToken });
  return mapAccount(raw as Parameters<typeof mapAccount>[0]);
}

export const updateClient = (
  accessToken: string,
  patch: { phoneNumber?: string; email?: string },
) =>
  ecashFetch<unknown>('/mobile/account/update-client', {
    method: 'PUT',
    token: accessToken,
    body: patch,
  });

/**
 * Смена пароля тем, кто помнит текущий (в отличие от сброса по SMS).
 *
 * `accountId` в модели Swagger есть, но НЕ передаём: обязательным он не
 * является (на пустое тело ядро требует только CurrentPassword и NewPassword,
 * проверено запросом 14.08.2026), а сам идентификатор уже лежит в клейме
 * `accountId` пользовательского JWT — ядро берёт владельца оттуда, как и в
 * брони. Дать браузеру возможность прислать сюда чужой id — лишний риск
 * ради поля, которое всё равно игнорируется.
 *
 * Тело успеха, как и у остальных операций, в Swagger не описано, поэтому
 * действуем как в otpResetPassword: явный `false` считаем отказом, всё
 * остальное — успехом.
 */
export const changePassword = async (
  accessToken: string,
  currentPassword: string,
  newPassword: string,
): Promise<boolean> => {
  const res = await ecashFetch<unknown>('/mobile/account/change-password', {
    method: 'POST',
    token: accessToken,
    body: { currentPassword, newPassword },
  });
  if (res === false) return false;
  if (typeof res === 'object' && res !== null) {
    const r = res as { success?: unknown; data?: unknown };
    if (r.success === false || r.data === false) return false;
  }
  return true;
};

