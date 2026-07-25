import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { competitors, news, rateSnapshots } from './schema';

/**
 * Идемпотентный сид справочного контента (новости, конкуренты, история курса).
 * Запуск: npx tsx src/server/db/seed.ts — или npm run db:seed.
 */
async function main() {
  const client = postgres(process.env.DATABASE_URL ?? 'postgres://ecash:ecash@localhost:5432/ecash', {
    max: 1,
  });
  const db = drizzle(client);

  await db
    .insert(competitors)
    .values([
      { id: 'c1', nameKey: 'blue', color: 'var(--color-competitor-3)', buy: '539', sell: '541.4' },
      { id: 'c2', nameKey: 'green', color: 'var(--color-competitor-2)', buy: '539', sell: '541.4' },
      { id: 'c3', nameKey: 'red', color: 'var(--color-competitor-1)', buy: '539', sell: '541.4' },
    ])
    .onConflictDoNothing();

  const day = 86_400_000;
  await db
    .insert(news)
    .values([
      {
        slug: 'travelers',
        image: '/img/news-travelers.png',
        key: 'travelers',
        publishedAt: new Date(Date.now() - 2 * day),
      },
      {
        slug: 'city-dwellers',
        image: '/img/news-city.png',
        key: 'cityDwellers',
        publishedAt: new Date(Date.now() - 3 * day),
      },
    ])
    .onConflictDoNothing();

  await backfillRateHistory(db);

  await client.end();
  console.warn('seed: ok');
}

/**
 * Бэкофилл rate_snapshots за прошлый год для отделения 1: свежий стенд
 * копит историю сам (снапшоттер раз в 15 мин, см. server/jobs/snapshots.ts),
 * но пока он не проработал год — график «Динамика курса» на Месяц/Год
 * показывает почти плоскую линию с точками, слипшимися в правом крае (вся
 * реальная история — это последние несколько дней работы стенда). Только
 * dep 1 — это единственное отделение, чью историю запрашивает калькулятор
 * на главной (DEP_ID в Calculator.tsx). Достраиваем историю назад от самой
 * старой реальной точки для каждой валюты — только если эта точка моложе
 * 30 дней, иначе история уже накопилась сама и трогать нечего (идемпотентно
 * и самоограничивается по мере реального аптайма).
 */
async function backfillRateHistory(db: ReturnType<typeof drizzle>) {
  const pairs = await db.execute<{ currency_code: string; oldest: string; buy: string; sell: string }>(sql`
    select distinct on (currency_code)
      currency_code,
      first_value(taken_at) over w as oldest,
      first_value(buy) over w as buy,
      first_value(sell) over w as sell
    from rate_snapshots
    where dep_id = 1
    window w as (partition by currency_code order by taken_at asc)
  `);

  const day = 86_400_000;
  const now = Date.now();
  const rows: (typeof rateSnapshots.$inferInsert)[] = [];

  for (const p of pairs) {
    const oldest = new Date(p.oldest).getTime();
    if (now - oldest > 30 * day) continue; // история уже накопилась сама

    const anchorBuy = Number(p.buy);
    const anchorSell = Number(p.sell);
    if (!(anchorBuy > 0) || !(anchorSell > 0)) continue;
    const spread = anchorSell / anchorBuy;

    let sellWalk = anchorSell;
    for (let i = 1; i <= 365; i += 1) {
      const drift = (Math.random() - 0.5) * 0.006; // ~±0.3% в день
      const revert = (anchorSell - sellWalk) * 0.03; // мягкий возврат к якорю
      sellWalk = sellWalk * (1 + drift) + revert;
      rows.push({
        depId: 1,
        currencyCode: p.currency_code,
        buy: (sellWalk / spread).toFixed(2),
        sell: sellWalk.toFixed(2),
        takenAt: new Date(oldest - i * day),
      });
    }
  }

  // одним запросом драйвер СУБД не тянет: на ~250 парах × 365 строк построение
  // SQL для insert переполняло стек рекурсивным merge — вставляем пачками.
  const CHUNK = 1000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.insert(rateSnapshots).values(rows.slice(i, i + CHUNK));
  }
  console.warn(`seed: rate_snapshots backfill — ${rows.length} строк по ${pairs.length} валютам (dep 1)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
