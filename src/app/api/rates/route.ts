import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { competitors, favorites } from '@/server/db/schema';
import { rateStatistics } from '@/server/ecash/endpoints/rates';
import { marketRate } from '@/server/ecash/market-rate';
import { sessionAccountId } from '@/server/session';
import { fromError, ok } from '@/server/api/respond';

/**
 * Курсы отделения + конкуренты + избранное сессии + биржевой курс НБ РК.
 *
 * Курсы отделения (rateStatistics) — обязательная часть ответа: если она
 * падает, эндпоинт возвращает ошибку. Конкуренты/избранное — наши
 * вспомогательные данные из Postgres; если БД недоступна, они не должны
 * ронять центральный экран приложения — отдаём курсы без них.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const depId = Number(url.searchParams.get('depId') ?? '1') || 1;

  let rates: Awaited<ReturnType<typeof rateStatistics>>;
  let market: Awaited<ReturnType<typeof marketRate>>;
  try {
    [rates, market] = await Promise.all([rateStatistics(depId), marketRate('USD')]);
  } catch (e) {
    return fromError(e);
  }

  const [compsResult, favsResult] = await Promise.allSettled([
    db.select().from(competitors),
    sessionAccountId().then((accountId) =>
      accountId
        ? db.select().from(favorites).where(eq(favorites.accountId, accountId))
        : Promise.resolve([]),
    ),
  ]);

  const comps = compsResult.status === 'fulfilled' ? compsResult.value : [];
  const favs = favsResult.status === 'fulfilled' ? favsResult.value.map((f) => f.currencyCode) : [];

  /**
   * «Курс на бирже» в макете подписан у каждой строки курсов, поэтому отдаём
   * карту НБ РК по всем валютам отделения. marketRate уже разрешён выше —
   * фид закэширован, вызовы ниже читают тот же Map без сетевых запросов.
   * Валюты вне фида НБ РК (золото) в карту просто не попадают.
   */
  const marketPairs = await Promise.all(
    rates.map(async (r) => [r.currencyCode, await marketRate(r.currencyCode)] as const),
  );
  const marketRates: Record<string, number> = {};
  for (const [code, value] of marketPairs) {
    if (value !== null) marketRates[code] = value;
  }

  return ok({
    depId,
    marketRate: market,
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
}
