import 'server-only';
import { cache } from 'react';
import type { Account } from '@/lib/domain';
import { accountMe } from '@/server/ecash/endpoints/account';
import { EcashError } from '@/server/ecash/errors';
import { userToken } from '@/server/session';

/**
 * Текущий аккаунт по токену сессии — единая точка для /api/auth/me и гарда
 * админки: личность всегда подтверждается ядром Ecash, локальной копии нет.
 *
 * ВНИМАНИЕ: внутри `userToken()`, который при истёкшем access-токене ротирует
 * куку. Ставить куки можно только из route handlers, поэтому в Server
 * Components это звать НЕЛЬЗЯ — там `sessionIsAdmin()` из session.ts.
 *
 * `cache()` снимает повторные вызовы в пределах одного запроса.
 */
export const currentAccount = cache(async (): Promise<Account | null> => {
  const token = await userToken();
  if (!token) return null;
  try {
    return await accountMe(token);
  } catch (e) {
    // отозванный токен — это гость, а не сбой
    if (e instanceof EcashError && e.httpStatus === 401) return null;
    throw e;
  }
});
