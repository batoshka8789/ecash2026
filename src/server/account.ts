import 'server-only';
import { cache } from 'react';
import type { Account } from '@/lib/domain';
import { accountMe } from '@/server/ecash/endpoints/account';
import { EcashError } from '@/server/ecash/errors';
import { demoAccount, isDemoToken } from '@/server/demo/store';
import { readSession, userToken } from '@/server/session';

/**
 * Текущий аккаунт — единая точка для демо и реального режима. Раньше эта
 * развилка жила прямо в /api/auth/me и дублировалась бы в каждом новом месте.
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
    if (isDemoToken(token)) {
      const s = await readSession();
      return demoAccount(s?.accountId.replace(/^demo-/, '') ?? '');
    }
    return await accountMe(token);
  } catch (e) {
    // отозванный токен — это гость, а не сбой
    if (e instanceof EcashError && e.httpStatus === 401) return null;
    throw e;
  }
});
