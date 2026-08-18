import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { favorites } from '@/server/db/schema';
import { withUser } from '@/server/api/guard';
import { body, fail, ok } from '@/server/api/respond';
import { favoriteToggleBody } from '@/shared/schemas';
import { readSession } from '@/server/session';

/** Переключение избранной валюты; возвращает полный список. */
export const POST = withUser(async (req) => {
  const parsed = await body(req, favoriteToggleBody);
  if (parsed instanceof NextResponse) return parsed;

  const s = await readSession();
  const accountId = s!.accountId;

  try {
    const deleted = await db
      .delete(favorites)
      .where(and(eq(favorites.accountId, accountId), eq(favorites.currencyCode, parsed.code)))
      .returning();

    if (deleted.length === 0) {
      /*
       * onConflictDoNothing, а не голый insert: «удалить, а если нечего —
       * вставить» это проверка и действие двумя запросами, и между ними
       * успевает вклиниться второй такой же запрос. Оба удаляют ноль строк,
       * оба вставляют, второй ловит нарушение уникальности первичного ключа
       * (accountId, currencyCode) и отдаёт 500. Воспроизводится обычным
       * быстрым двойным нажатием на звёздочку — двадцать параллельных
       * переключений в проверке давали россыпь пятисоток.
       *
       * Конфликт здесь означает «валюта уже в избранном» — ровно то
       * состояние, которого добивался запрос, поэтому его молча принимаем.
       */
      await db
        .insert(favorites)
        .values({ accountId, currencyCode: parsed.code })
        .onConflictDoNothing();
    }

    const rows = await db.select().from(favorites).where(eq(favorites.accountId, accountId));
    return ok({ favorites: rows.map((r) => r.currencyCode) });
  } catch (e) {
    // тот же случай, что в profile: путь целиком наш, упасть может только база
    console.warn('[favorites] переключение не сохранилось', (e as Error).message);
    return fail('errors.serverError', 503);
  }
});
