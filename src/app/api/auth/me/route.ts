import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { profiles } from '@/server/db/schema';
import { accountMe } from '@/server/ecash/endpoints/account';
import { fromError, ok } from '@/server/api/respond';
import { readSession, userToken } from '@/server/session';
import { demoAccount, isDemoToken } from '@/server/demo/store';
import { EcashError } from '@/server/ecash/errors';
import { profileFromRow } from '@/server/db/profile';

/** Текущий аккаунт + наша анкета. { account: null } для гостя — без 401. */
export async function GET() {
  const token = await userToken();
  if (!token) return ok({ account: null });

  try {
    const s = await readSession();
    const account = isDemoToken(token)
      ? demoAccount(s?.accountId.replace(/^demo-/, '') ?? '')
      : await accountMe(token);

    const rows = await db
      .select()
      .from(profiles)
      .where(eq(profiles.accountId, account.accountId));

    return ok({ account: { ...account, profile: profileFromRow(rows[0]) } });
  } catch (e) {
    // сессия с отозванным токеном — гость, а не ошибка
    if (e instanceof EcashError && e.httpStatus === 401) return ok({ account: null });
    return fromError(e);
  }
}
