import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { rateAlerts } from '@/server/db/schema';
import { withUser } from '@/server/api/guard';
import { body, fail, fromError, ok } from '@/server/api/respond';
import { rateAlertBody } from '@/shared/schemas';
import { readSession } from '@/server/session';
import { isPlausibleTargetRate } from '@/lib/exchange';
import { alertCurrency } from '@/lib/rate-alert';
import { rateStatistics } from '@/server/ecash/endpoints/rates';
import { depList } from '@/server/ecash/endpoints/departments';

/** Подписки «уведомить об изменении курса» — наш слой поверх события rate.changed. */

const toDto = (r: typeof rateAlerts.$inferSelect) => ({
  id: r.id,
  currencyFrom: r.currencyFrom,
  currencyTo: r.currencyTo,
  targetRate: Number(r.targetRate),
  until: r.until.toISOString(),
  active: r.active && r.until.getTime() > Date.now(),
  createdAt: r.createdAt.toISOString(),
});

export const GET = withUser(async () => {
  const s = await readSession();
  try {
    const rows = await db
      .select()
      .from(rateAlerts)
      .where(eq(rateAlerts.accountId, s!.accountId))
      .orderBy(desc(rateAlerts.createdAt));
    return ok({ alerts: rows.map(toDto) });
  } catch (e) {
    return fromError(e);
  }
});

/**
 * Текущий курс валюты по сети — для проверки правдоподобности отметки.
 * Недоступен апстрим — возвращаем 0, и проверка пропускает: блокировать
 * подписку из-за чужого сбоя нельзя.
 */
async function currentMarketRate(code: string): Promise<number> {
  try {
    const deps = await depList();
    for (const d of deps) {
      const stats = await rateStatistics(d.depId).catch(() => []);
      const hit = stats.find((s) => s.currencyCode === code);
      if (hit && hit.sell > 0) return hit.sell;
    }
  } catch {
    // список отделений или курсы недоступны — не наша забота на этом шаге
  }
  return 0;
}

export const POST = withUser(async (req) => {
  const parsed = await body(req, rateAlertBody);
  if (parsed instanceof NextResponse) return parsed;

  /**
   * Правдоподобность отметки проверяет и форма, но проверять надо здесь:
   * форму можно обойти, а последствие у неверной отметки не косметическое.
   *
   * В поле «Уведомить при курсе» вводят курс ЗА ЕДИНИЦУ, но легко ввести
   * сумму обмена. Отметка вроде 999 999 ₸ за доллар для покупателя
   * срабатывает НЕМЕДЛЕННО — любой реальный курс продажи её проходит, — и
   * человек получает push «курс достиг вашей отметки» в ближайшие 15 минут,
   * не поняв, почему. Обратная ошибка тише, но так же бессмысленна: отметка
   * не наступит никогда.
   *
   * Допуск тот же, что в форме (÷10 … ×10) — ждать сильного движения курса
   * не мешаем, а промах на порядок ловим.
   */
  const code = alertCurrency(parsed.currencyFrom, parsed.currencyTo);
  if (code) {
    const current = await currentMarketRate(code);
    if (!isPlausibleTargetRate(parsed.targetRate, current)) {
      return fail('errors.rateImplausible', 400, { field: 'targetRate' });
    }
  }

  const s = await readSession();
  try {
    const [row] = await db
      .insert(rateAlerts)
      .values({
        accountId: s!.accountId,
        currencyFrom: parsed.currencyFrom,
        currencyTo: parsed.currencyTo,
        targetRate: String(parsed.targetRate),
        until: new Date(parsed.until),
      })
      .returning();
    return ok({ alert: toDto(row) }, { status: 201 });
  } catch (e) {
    return fromError(e);
  }
});
