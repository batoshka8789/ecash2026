import 'server-only';
import type { Account } from '@/lib/domain';
import { env } from '@/server/env';
import { samePhone } from '@/shared/phone';

/**
 * Права администратора. Отдельный модуль без зависимостей от сессии и сети:
 * его импортируют и `session.ts` (гард страниц), и `account.ts` (гард API), —
 * общий файл разорвал бы цикл между ними.
 *
 * Роль НИГДЕ не хранится: считается от окружения при каждой проверке, поэтому
 * удаление номера из ADMIN_PHONES отбирает доступ сразу, а не через 30 дней
 * жизни сессионной куки.
 */
export function isAdminPhone(phone: string): boolean {
  if (!phone) return false;
  // В демо-режиме войти можно под ЛЮБЫМ номером с общим паролем
  // (см. demoCheckPassword), поэтому знание номера админа означало бы права
  // админа. Открываем только явным флагом ADMIN_IN_DEMO=1.
  if (env.ECASH_OTP_MOCK && !env.ADMIN_IN_DEMO) return false;
  return env.ADMIN_PHONES.some((allowed) => samePhone(allowed, phone));
}

export const isAdminAccount = (account: Account | null): boolean =>
  Boolean(account && isAdminPhone(account.phoneNumber));
