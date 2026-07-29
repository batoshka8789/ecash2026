import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { competitors, favorites } from '@/server/db/schema';
import { allMarketRates, marketRate } from '@/server/ecash/market-rate';
import { sessionAccountId } from '@/server/session';
import { ok } from '@/server/api/respond';

/**
 * Наша добавка к курсам отделения: биржевой курс НБ РК, избранные валюты
 * сессии и курсы конкурентов.
 *
 * Сами курсы Ecash сюда НЕ ходят — их браузер берёт напрямую с
 * api-dev.quiq.kz (`/mobile/rates/statistics/{depId}`), см. ecash-direct.ts.
 * Здесь остаётся только то, чего у Ecash нет:
 *   • НБ РК — публичный XML nationalbank.kz, чужой домен;
 *   • избранное — наша Postgres, привязано к аккаунту сессии;
 *   • конкуренты — наша Postgres.
 *
 * Ни одна из трёх частей не критична для экрана курсов: если Postgres лежит,
 * отдаём пустые списки, а не роняем главную. Поэтому allSettled.
 */
export async function GET() {
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

  const comps = compsResult.status === 'fulfilled' ? compsResult.value : [];
  const favs = favsResult.status === 'fulfilled' ? favsResult.value.map((f) => f.currencyCode) : [];

  return ok({
    marketRate: marketResult.status === 'fulfilled' ? marketResult.value : null,
    marketRates: allResult.status === 'fulfilled' ? allResult.value : {},
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
