import { and, eq, gte } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { rateSnapshots } from '@/server/db/schema';
import { rateStatistics } from '@/server/ecash/endpoints/rates';
import { fail, fromError, ok } from '@/server/api/respond';

/**
 * История курса для графика: объединение нашей накопленной истории
 * (rate_snapshots каждые 15 мин) и upstream history[] (данных там почти нет).
 * Периоды из макета: day / week / month / year.
 */

const PERIODS: Record<string, number> = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const depId = Number(url.searchParams.get('depId') ?? '1') || 1;
  const code = (url.searchParams.get('code') ?? 'USD').toUpperCase();
  const period = url.searchParams.get('period') ?? 'week';
  const days = PERIODS[period];
  if (!days) return fail('errors.badBody', 400, { field: 'period' });

  const since = new Date(Date.now() - days * 86_400_000);

  try {
    const [snapshots, stats] = await Promise.all([
      db
        .select()
        .from(rateSnapshots)
        .where(
          and(
            eq(rateSnapshots.depId, depId),
            eq(rateSnapshots.currencyCode, code),
            gte(rateSnapshots.takenAt, since),
          ),
        )
        .orderBy(rateSnapshots.takenAt),
      rateStatistics(depId).catch(() => []),
    ]);

    const stat = stats.find((s) => s.currencyCode === code);

    // объединение по дате: снапшоты точнее (в течение дня), upstream — по дням
    const points = new Map<string, { t: string; buy: number; sell: number }>();
    for (const h of stat?.history ?? []) {
      if (Date.parse(h.date) >= since.getTime()) {
        points.set(h.date, { t: h.date, buy: h.buy, sell: h.sell });
      }
    }
    for (const s of snapshots) {
      const t = s.takenAt.toISOString();
      points.set(t, { t, buy: Number(s.buy), sell: Number(s.sell) });
    }

    const sorted = [...points.values()].sort((a, b) => a.t.localeCompare(b.t));
    return ok({
      depId,
      code,
      period,
      current: stat ? { buy: stat.buy, sell: stat.sell, change: stat.change } : null,
      points: sorted,
    });
  } catch (e) {
    return fromError(e);
  }
}
