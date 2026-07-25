import { and, eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { rateAlerts } from '@/server/db/schema';
import { withUser } from '@/server/api/guard';
import { fail, fromError, ok } from '@/server/api/respond';
import { readSession } from '@/server/session';

/** Отключение подписки. Проверка владельца — в WHERE, не после чтения. */
export const DELETE = withUser(async (_req, _token, ctx) => {
  const { id } = await ctx.params;
  const s = await readSession();
  try {
    const rows = await db
      .delete(rateAlerts)
      .where(and(eq(rateAlerts.id, id), eq(rateAlerts.accountId, s!.accountId)))
      .returning();
    if (rows.length === 0) return fail('errors.notFound', 404);
    return ok({ ok: true });
  } catch (e) {
    return fromError(e);
  }
});
