import 'server-only';
import { and, eq, gt, gte, isNull, lte } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { rateAlerts, rateSnapshots } from '@/server/db/schema';
import { depList } from '@/server/ecash/endpoints/departments';
import { rateStatistics } from '@/server/ecash/endpoints/rates';

/**
 * Снапшоттер курсов: раз в 15 минут пишет buy/sell по каждому отделению
 * в rate_snapshots — наша собственная история для графика
 * Сутки/Неделя/Месяц/Год (upstream history[] почти пуст).
 * Запускается из instrumentation.ts; singleton через globalThis.
 */

const INTERVAL_MS = 15 * 60_000;
const g = globalThis as unknown as { __ecashSnapshotter?: ReturnType<typeof setInterval> };

async function takeSnapshot(): Promise<void> {
  try {
    const deps = await depList();
    const rows: (typeof rateSnapshots.$inferInsert)[] = [];
    // последовательно, чтобы не давить upstream двадцатью запросами разом
    for (const dep of deps) {
      try {
        const stats = await rateStatistics(dep.depId);
        for (const s of stats) {
          if (s.buy <= 0 && s.sell <= 0) continue;
          rows.push({
            depId: dep.depId,
            currencyCode: s.currencyCode,
            buy: String(s.buy),
            sell: String(s.sell),
          });
        }
      } catch {
        // отделение без статистики — пропускаем, не роняя весь проход
      }
    }
    if (rows.length > 0) await db.insert(rateSnapshots).values(rows);
    await fireAlerts(rows);
    console.warn(`[snapshots] записано ${rows.length} строк по ${deps.length} отделениям`);
  } catch (e) {
    console.warn('[snapshots] проход не удался', e);
  }
}

/**
 * Срабатывание подписок «уведомить об изменении курса». Направление
 * закодировано порядком пары (как в бронировании):
 *  — KZT→валюта (клиент ПОКУПАЕТ): цель достигнута, когда курс ПРОДАЖИ
 *    обменника опустился до targetRate или ниже;
 *  — валюта→KZT (клиент ПРОДАЁТ): когда курс ПОКУПКИ поднялся до
 *    targetRate или выше.
 * Отметка firedAt ставится один раз — уведомление показывается в кабинете.
 */
async function fireAlerts(rows: (typeof rateSnapshots.$inferInsert)[]): Promise<void> {
  const bestSell = new Map<string, number>();
  const bestBuy = new Map<string, number>();
  for (const r of rows) {
    const sell = Number(r.sell);
    const buy = Number(r.buy);
    if (sell > 0) {
      const cur = bestSell.get(r.currencyCode);
      if (cur === undefined || sell < cur) bestSell.set(r.currencyCode, sell);
    }
    if (buy > 0) {
      const cur = bestBuy.get(r.currencyCode);
      if (cur === undefined || buy > cur) bestBuy.set(r.currencyCode, buy);
    }
  }
  for (const [code, sell] of bestSell) {
    await db
      .update(rateAlerts)
      .set({ firedAt: new Date() })
      .where(
        and(
          eq(rateAlerts.currencyFrom, 'KZT'),
          eq(rateAlerts.currencyTo, code),
          eq(rateAlerts.active, true),
          isNull(rateAlerts.firedAt),
          gt(rateAlerts.until, new Date()),
          lte(rateAlerts.targetRate, String(sell)),
        ),
      );
  }
  for (const [code, buy] of bestBuy) {
    await db
      .update(rateAlerts)
      .set({ firedAt: new Date() })
      .where(
        and(
          eq(rateAlerts.currencyFrom, code),
          eq(rateAlerts.currencyTo, 'KZT'),
          eq(rateAlerts.active, true),
          isNull(rateAlerts.firedAt),
          gt(rateAlerts.until, new Date()),
          gte(rateAlerts.targetRate, String(buy)),
        ),
      );
  }
}

export function startSnapshotter(): void {
  if (g.__ecashSnapshotter) return;
  g.__ecashSnapshotter = setInterval(() => void takeSnapshot(), INTERVAL_MS);
  // первый срез — сразу после старта, чтобы график получил точку
  setTimeout(() => void takeSnapshot(), 10_000);
}
