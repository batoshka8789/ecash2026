import 'server-only';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { rateAlerts, rateSnapshots } from '@/server/db/schema';
import { depList } from '@/server/ecash/endpoints/departments';
import { rateStatistics } from '@/server/ecash/endpoints/rates';
import { sendToAccounts } from '@/server/push';
import { alertCurrency, alertDirection, alertReached } from '@/lib/rate-alert';

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
 * Срабатывание подписок «уведомить об изменении курса».
 *
 * Само правило — в lib/rate-alert.ts, там же тесты. Раньше сравнение жило
 * прямо в SQL-условии и было перевёрнуто: подписка «сообщи, когда доллар
 * подешевеет до 500» срабатывала сразу при создании, а на реальном
 * достижении курса молчала. Проверить SQL-условие нечем — поэтому решение
 * принимается в коде, а запрос лишь отбирает кандидатов и проставляет
 * отметку.
 *
 * Отметка firedAt ставится один раз, и по `.returning()` мы узнаём, какие
 * подписки сработали ИМЕННО СЕЙЧАС — это и есть повод отправить push. Между
 * отбором и обновлением стоит повторная проверка `isNull(firedAt)`: если
 * два прохода наложатся, второй не отправит то же самое дважды.
 */
async function fireAlerts(rows: (typeof rateSnapshots.$inferInsert)[]): Promise<void> {
  /** лучшие курсы рынка: покупателю — самая низкая продажа, продавцу — самая высокая покупка */
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

  const now = new Date();
  const candidates = await db
    .select()
    .from(rateAlerts)
    .where(and(eq(rateAlerts.active, true), isNull(rateAlerts.firedAt), gt(rateAlerts.until, now)));

  /** сработавшие сейчас: аккаунт, валюта и курс, который её вызвал */
  const fired: { accountId: string; code: string; rate: number; side: 'buy' | 'sell' }[] = [];

  for (const a of candidates) {
    const direction = alertDirection(a.currencyFrom, a.currencyTo);
    const code = alertCurrency(a.currencyFrom, a.currencyTo);
    if (!direction || !code) continue;

    const best = direction === 'buying' ? bestSell.get(code) : bestBuy.get(code);
    if (!alertReached(direction, Number(a.targetRate), best)) continue;

    const hit = await db
      .update(rateAlerts)
      .set({ firedAt: new Date() })
      .where(and(eq(rateAlerts.id, a.id), isNull(rateAlerts.firedAt)))
      .returning({ accountId: rateAlerts.accountId });

    for (const r of hit) {
      fired.push({
        accountId: r.accountId,
        code,
        rate: best!,
        side: direction === 'buying' ? 'buy' : 'sell',
      });
    }
  }

  if (fired.length > 0) await notifyFired(fired);
}

/**
 * Push по сработавшим подпискам. Отправка не должна ронять проход
 * снапшоттера: отметка firedAt уже стоит, уведомление в кабинете человек
 * увидит в любом случае — push здесь лишь способ доставить его быстрее.
 */
async function notifyFired(
  fired: { accountId: string; code: string; rate: number; side: 'buy' | 'sell' }[],
): Promise<void> {
  // Один человек мог подписаться на несколько валют, и все они сработали в
  // один проход — шлём по одному сообщению на валюту, но метка общая, чтобы
  // на экране не выросла стопка.
  const byAccount = new Map<string, typeof fired>();
  for (const f of fired) {
    const list = byAccount.get(f.accountId) ?? [];
    list.push(f);
    byAccount.set(f.accountId, list);
  }

  for (const [accountId, list] of byAccount) {
    const first = list[0];
    const rate = formatRate(first.rate);
    try {
      await sendToAccounts([accountId], {
        title: 'Курс достиг вашей отметки',
        body:
          list.length === 1
            ? `${first.code} — ${rate} ₸. ${first.side === 'buy' ? 'Можно покупать' : 'Можно продавать'}.`
            : `${list.map((f) => f.code).join(', ')} — курс дошёл до заданных значений.`,
        url: '/notifications',
        tag: 'rate-alert',
      });
    } catch (e) {
      console.warn('[snapshots] push по подписке не ушёл', e);
    }
  }
}

/** Курс в тексте уведомления: без хвоста нулей, но с копейками, если есть. */
function formatRate(v: number): string {
  return v.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

export function startSnapshotter(): void {
  if (g.__ecashSnapshotter) return;
  g.__ecashSnapshotter = setInterval(() => void takeSnapshot(), INTERVAL_MS);
  // первый срез — сразу после старта, чтобы график получил точку
  setTimeout(() => void takeSnapshot(), 10_000);
}
