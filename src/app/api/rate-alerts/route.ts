import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { rateAlerts } from '@/server/db/schema';
import { withUser } from '@/server/api/guard';
import { body, fromError, ok } from '@/server/api/respond';
import { rateAlertBody } from '@/shared/schemas';
import { readSession } from '@/server/session';

/** Подписки «уведомить об изменении курса» — наш слой поверх события rate.changed. */

const toDto = (r: typeof rateAlerts.$inferSelect) => ({
  id: r.id,
  currencyFrom: r.currencyFrom,
  currencyTo: r.currencyTo,
  targetRate: Number(r.targetRate),
  until: r.until.toISOString(),
  active: r.active && r.until.getTime() > Date.now(),
  createdAt: r.createdAt.toISOString(),
});

export const GET = withUser(async () => {
  const s = await readSession();
  try {
    const rows = await db
      .select()
      .from(rateAlerts)
      .where(eq(rateAlerts.accountId, s!.accountId))
      .orderBy(desc(rateAlerts.createdAt));
    return ok({ alerts: rows.map(toDto) });
  } catch (e) {
    return fromError(e);
  }
});

export const POST = withUser(async (req) => {
  const parsed = await body(req, rateAlertBody);
  if (parsed instanceof NextResponse) return parsed;

  const s = await readSession();
  try {
    const [row] = await db
      .insert(rateAlerts)
      .values({
        accountId: s!.accountId,
        currencyFrom: parsed.currencyFrom,
        currencyTo: parsed.currencyTo,
        targetRate: String(parsed.targetRate),
        until: new Date(parsed.until),
      })
      .returning();
    return ok({ alert: toDto(row) }, { status: 201 });
  } catch (e) {
    return fromError(e);
  }
});
