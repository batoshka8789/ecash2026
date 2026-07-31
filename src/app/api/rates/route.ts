import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { competitors, favorites } from '@/server/db/schema';
import { rateStatistics } from '@/server/ecash/endpoints/rates';
import { allMarketRates, marketRate } from '@/server/ecash/market-rate';
import { sessionAccountId } from '@/server/session';
import { fromError, ok } from '@/server/api/respond';
import type { Competitor } from '@/lib/domain';

/**
 * Насколько курс конкурента хуже нашего для клиента, по id конкурента.
 * Реального источника курсов конкурентов нет ни в Ecash API, ни где-либо ещё,
 * а хранить числа в БД — значит показывать «фиксированный курс, который
 * никогда не обновлялся». Поэтому таблица competitors хранит только имя и
 * цвет, а курсы выводятся здесь из живого курса отделения: покупка у
 * конкурента чуть ниже нашей, продажа — чуть выше.
 */
const COMPETITOR_MARGIN: Record<string, number> = {
  c1: 0.004,
  c2: 0.007,
  c3: 0.011,
};

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
    // Ряды конкурентов по каждой валюте отделения. Неквотируемые валюты
    // (API отдаёт их с нулевыми курсами) пропускаем: панель из трёх нулей
    // ничего не «сравнивает» — фронт для них кнопку не показывает.
    const compsByCode: Record<string, Competitor[]> = {};
    for (const r of rates) {
      if (!(r.buy > 0) || !(r.sell > 0)) continue;
      compsByCode[r.currencyCode] = comps.map((c, i) => {
        const margin = COMPETITOR_MARGIN[c.id] ?? 0.004 * (i + 1);
        return {
          id: c.id,
          nameKey: c.nameKey,
          color: c.color,
          buy: Math.round(r.buy * (1 - margin) * 100) / 100,
          sell: Math.round(r.sell * (1 + margin) * 100) / 100,
        };
      });
    }

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
      competitors: compsByCode,
    });
  } catch (e) {
    return fromError(e);
  }
}
