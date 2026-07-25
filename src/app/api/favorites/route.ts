import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { favorites } from '@/server/db/schema';
import { withUser } from '@/server/api/guard';
import { body, fromError, ok } from '@/server/api/respond';
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
      await db.insert(favorites).values({ accountId, currencyCode: parsed.code });
    }
    const rows = await db.select().from(favorites).where(eq(favorites.accountId, accountId));
    return ok({ favorites: rows.map((r) => r.currencyCode) });
  } catch (e) {
    return fromError(e);
  }
});
