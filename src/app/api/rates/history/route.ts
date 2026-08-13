import { and, eq, gte } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { rateSnapshots } from '@/server/db/schema';
import { rateStatistics } from '@/server/ecash/endpoints/rates';
import { assertVisibleDep, depList } from '@/server/ecash/endpoints/departments';
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

/**
 * Отделение для графика. Задано — берём его; не задано — первое из живого
 * списка. Раньше здесь стояло `?? '1'`: отделение №1 существует на
 * дев-контуре Ecash по совпадению, на боевом такого id может не быть, и
 * график молча строился бы по пустой выборке.
 */
async function resolveDepId(explicit: string | null): Promise<number> {
  const n = Number(explicit);
  if (Number.isInteger(n) && n > 0) {
    // тот же фильтр, что и в списке: скрытое отделение не должно рисовать график
    await assertVisibleDep(n);
    return n;
  }
  const deps = await depList();
  const first = deps[0]?.depId;
  if (!first) throw new Error('Ecash: список отделений пуст');
  return first;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = (url.searchParams.get('code') ?? 'USD').toUpperCase();
  const period = url.searchParams.get('period') ?? 'week';
  const days = PERIODS[period];
  if (!days) return fail('errors.badBody', 400, { field: 'period' });

  const since = new Date(Date.now() - days * 86_400_000);

  try {
    // Внутри try намеренно: resolveDepId ходит в Ecash за списком и бросает на
    // скрытом/несуществующем отделении. Снаружи этот бросок ловить было
    // некому — Next отдавал голую 500 вместо честного 404.
    const depId = await resolveDepId(url.searchParams.get('depId'));
    // Наша история — необязательная часть графика: при недоступной базе
    // рисуем по дневным точкам апстрима, а не отдаём пятисотку. Так же
    // устроен /api/rates, где Postgres и nationalbank.kz идут через
    // allSettled. Раньше здесь стоял Promise.all, и сбой базы уносил график
    // целиком, хотя данные для него есть и без неё.
    const [snapResult, stats] = await Promise.all([
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
        .orderBy(rateSnapshots.takenAt)
        .catch((e) => {
          console.warn('[rates/history] своя история недоступна, рисую по апстриму', e);
          return [] as (typeof rateSnapshots.$inferSelect)[];
        }),
      rateStatistics(depId).catch(() => []),
    ]);
    const snapshots = snapResult;

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
