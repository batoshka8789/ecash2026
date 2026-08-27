import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { competitors, favorites } from '@/server/db/schema';
import { rateStatistics } from '@/server/ecash/endpoints/rates';
import { assertVisibleDep, depInfo, depList } from '@/server/ecash/endpoints/departments';
import { allMarketRates, marketRate } from '@/server/ecash/market-rate';
import { sessionAccountId } from '@/server/session';
import { fromError, ok } from '@/server/api/respond';
import { canonicalCity } from '@/lib/branch-address';
import type { Competitor } from '@/lib/domain';

/**
 * Заказчик попросил не показывать «синего» конкурента (реальный бизнес за
 * анонимным цветом — в Астане и Актобе его нет) в отделениях этих городов:
 * сравнение с конкурентом, которого там физически не существует, вводит
 * в заблуждение, даром что сама цифра и так синтетическая (см. ниже).
 */
const NO_BLUE_CITIES = ['Астана', 'Актобе'];

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
 * Те же три ряда, что кладёт сид, — фоллбэк на случай пустой таблицы.
 * На Railway при деплое выполняются только миграции, сид не запускается —
 * без фоллбэка блок «Сравнить с конкурентами» на проде просто исчезал.
 */
const DEFAULT_COMPETITORS = [
  { id: 'c1', nameKey: 'blue', color: 'var(--color-competitor-3)' },
  { id: 'c2', nameKey: 'green', color: 'var(--color-competitor-2)' },
  { id: 'c3', nameKey: 'red', color: 'var(--color-competitor-1)' },
];

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
/**
 * Отделение для ответа.
 *
 * Задано явно — берём его как есть: человек выбрал конкретную кассу, и
 * подменять её нельзя, даже если курсов там нет (тогда честный 404).
 *
 * Не задано — выбираем САМИ, и обязательно то, у которого курсы есть.
 * Раньше здесь стояло `?? '1'`: отделение №1 существует на дев-контуре
 * Ecash по совпадению, на боевом такого id может не быть вовсе. Плюс даже
 * существующее отделение может не иметь статистики — у нас такое есть
 * (Onemotion отдаёт STATISTICS_NOT_FOUND), — и главная встречала бы
 * посетителя ошибкой вместо курсов. Перебираем список по порядку, пока
 * не найдём рабочее; список закеширован на 5 минут, лишних запросов нет.
 */
async function resolveRates(explicit: number | null) {
  if (explicit != null) {
    // явный id всё равно проверяем на видимость: иначе `?depId=40` отдавал бы
    // курсы служебного отделения дев-контура в обход фильтра списка
    await assertVisibleDep(explicit);
    return { depId: explicit, rates: await rateStatistics(explicit) };
  }

  const deps = await depList();
  let lastError: unknown = null;
  for (const d of deps) {
    try {
      const rates = await rateStatistics(d.depId);
      if (rates.length > 0) return { depId: d.depId, rates };
    } catch (e) {
      lastError = e;
    }
  }
  // ни одно отделение не отдало курсы — это уже сбой апстрима, не наш выбор
  throw lastError ?? new Error('Ecash: ни одно отделение не отдало курсы');
}

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('depId');
  const explicit = raw != null && Number(raw) > 0 ? Number(raw) : null;

  try {
    const { depId, rates } = await resolveRates(explicit);

    const [marketResult, allResult, compsResult, favsResult, depInfoResult] =
      await Promise.allSettled([
        marketRate('USD'),
        allMarketRates(),
        db.select().from(competitors),
        sessionAccountId().then((accountId) =>
          accountId
            ? db.select().from(favorites).where(eq(favorites.accountId, accountId))
            : Promise.resolve([]),
        ),
        depInfo(depId),
      ]);

    const all = allResult.status === 'fulfilled' ? allResult.value : {};
    const marketRates: Record<string, number> = {};
    for (const r of rates) {
      const v = all[r.currencyCode.toUpperCase()];
      if (typeof v === 'number') marketRates[r.currencyCode] = v;
    }

    const depCity = depInfoResult.status === 'fulfilled' ? canonicalCity(depInfoResult.value.city) : null;
    const compRows = compsResult.status === 'fulfilled' ? compsResult.value : [];
    const comps = (compRows.length ? compRows : DEFAULT_COMPETITORS).filter(
      (c) => !(c.nameKey === 'blue' && depCity && NO_BLUE_CITIES.includes(depCity)),
    );
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
