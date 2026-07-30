import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { competitors, favorites } from '@/server/db/schema';
import { rateStatistics } from '@/server/ecash/endpoints/rates';
import { allMarketRates, marketRate } from '@/server/ecash/market-rate';
import { sessionAccountId } from '@/server/session';
import { fromError, ok } from '@/server/api/respond';

/**
 * Курсы отделения одним ответом: курсы Ecash + курс НБ РК + избранное сессии
 * + конкуренты.
 *
 * Курсы Ecash — единственная обязательная часть, поэтому только она может
 * уронить ответ. Остальные три идут через allSettled: если Postgres или
 * nationalbank.kz недоступны, экран курсов всё равно открывается, просто без
 * биржевого курса, звёздочек и конкурентов.
 *
 * `marketRates` сужаем до валют этого отделения — контракт, на который
 * рассчитывают калькулятор, список курсов, бронь и подписка.
 */
export async function GET(req: Request) {
  const depId = Number(new URL(req.url).searchParams.get('depId') ?? '1') || 1;

  try {
    const rates = await rateStatistics(depId);

    const [marketResult, allResult, compsResult, favsResult] = await Promise.allSettled([
      marketRate('USD'),
      allMarketRates(),
      db.select().from(competitors),
      sessionAccountId().then((accountId) =>
        accountId
          ? db.select().from(favorites).where(eq(favorites.accountId, accountId))
          : Promise.resolve([]),
      ),
    ]);

    const all = allResult.status === 'fulfilled' ? allResult.value : {};
    const marketRates: Record<string, number> = {};
    for (const r of rates) {
      const v = all[r.currencyCode.toUpperCase()];
      if (typeof v === 'number') marketRates[r.currencyCode] = v;
    }

    const comps = compsResult.status === 'fulfilled' ? compsResult.value : [];
    const favs =
      favsResult.status === 'fulfilled' ? favsResult.value.map((f) => f.currencyCode) : [];

    return ok({
      depId,
      /** курс НБ РК по USD — историческая совместимость */
      marketRate: marketResult.status === 'fulfilled' ? marketResult.value : null,
      /** «Курс на бирже» по каждой валюте отделения (НБ РК) */
      marketRates,
      rates,
      favorites: favs,
      competitors: comps.map((c) => ({
        id: c.id,
        nameKey: c.nameKey,
        color: c.color,
        buy: Number(c.buy),
        sell: Number(c.sell),
      })),
    });
  } catch (e) {
    return fromError(e);
  }
}
