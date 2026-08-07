import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { profiles } from '@/server/db/schema';
import { fromError, ok } from '@/server/api/respond';
import { currentAccount } from '@/server/account';
import { isAdminAccount } from '@/server/admin';
import { profileFromRow } from '@/server/db/profile';

/**
 * Текущий аккаунт + наша анкета. { account: null } для гостя — без 401.
 * Развилка «демо/реальный режим» переехала в currentAccount(): она нужна
 * ещё и гарду админки, дублировать её здесь больше нечего.
 *
 * `isAdmin` считается на сервере, чтобы список телефонов админов не уезжал
 * в браузер — клиенту нужен только флаг для показа пункта меню. Запрос и так
 * идёт на каждой странице и обновляется по фокусу окна, поэтому снятые права
 * подхватываются сами.
 */
export async function GET() {
  try {
    const account = await currentAccount();
    if (!account) return ok({ account: null });

    /*
     * Анкета — необязательная добавка НАШЕГО слоя; личность и права приходят
     * от Ecash. Поэтому её падение не должно ронять ответ: раньше при
     * недоступной базе весь /auth/me отдавал 500, а это на каждой странице —
     * сайт считал вошедшего гостем, шапка мигала «Войти», кабинет
     * закрывался. Тот же приём уже применён в /api/rates (allSettled):
     * упавший необязательный источник просто отдаёт пустоту.
     */
    const rows = await db
      .select()
      .from(profiles)
      .where(eq(profiles.accountId, account.accountId))
      .catch((e) => {
        console.warn('[auth/me] анкета недоступна, отдаём аккаунт без неё', e);
        return [];
      });

    return ok({
      account: {
        ...account,
        isAdmin: isAdminAccount(account),
        profile: profileFromRow(rows[0]),
      },
    });
  } catch (e) {
    return fromError(e);
  }
}
