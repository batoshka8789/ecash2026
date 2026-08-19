import 'server-only';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { watchedRequests } from '@/server/db/schema';
import type { ExchangeRequest } from '@/lib/domain';

/**
 * Наблюдение за заявками ради push о решении казначея.
 *
 * Синхронизация написана так, что человек НЕ получает push о том, что сделал
 * или увидел сам: каждое действие и каждое чтение заявки через наш BFF
 * обновляет строку наблюдения до актуального состояния. Push уходит только
 * на переход, который первым заметил фоновый наблюдатель — то есть когда
 * человека на сайте не было.
 */

/** Снимок наблюдаемого состояния — ровно те поля, чьи переходы важны. */
export type WatchState = {
  status: number;
  needsConfirm: boolean;
};

/**
 * Статус для наблюдения — фаза, приведённая к каноническим кодам ядра.
 * Сырой статус для переходов непригоден: ядро ставит 8 «Забронирована»
 * сразу при создании, до ответа казначея, — наблюдатель видел бы 8 → 8 и
 * никогда не отправил бы «бронь подтверждена». Фаза же становится held
 * только после настоящего подтверждения (mappers.ts, treasurerConfirmed) —
 * переход 0 → 8 случается ровно в момент решения казначея.
 */
const PHASE_STATUS = { pending: 0, held: 8, done: 1, cancelled: 3 } as const;
export const watchStatus = (r: ExchangeRequest): number => PHASE_STATUS[r.phase];

export type WatchEvent = 'confirmed' | 'done' | 'cancelled' | 'offer';

/**
 * Какие push отправить при переходе prev → next. Чистая функция — вся
 * семантика переходов в одном месте и под тестами.
 *
 *   0 Введен · 8 Забронирована · 1 Проведена · 3 Отмена
 *
 * Порядок в массиве = порядок отправки (на практике событие одно, но
 * переход 0→1 минуя 8 теоретически возможен — тогда важнее «проведена»).
 */
export function watchEvents(prev: WatchState, next: WatchState): WatchEvent[] {
  const events: WatchEvent[] = [];
  if (!prev.needsConfirm && next.needsConfirm && next.status === 0) {
    events.push('offer'); // казначей предложил индивидуальный курс
  }
  if (prev.status !== 8 && next.status === 8) events.push('confirmed');
  if (prev.status !== 1 && next.status === 1) events.push('done');
  if (prev.status !== 3 && next.status === 3) events.push('cancelled');
  return events;
}

/** Статусы, после которых заявка уже не меняется — наблюдать нечего. */
export const isTerminal = (status: number): boolean => status === 1 || status === 3;

/**
 * Завести или синхронизировать строку наблюдения по живой заявке.
 * Вызывается из всех мест BFF, где заявка проходит через руки: создание,
 * отмена, ответ по индивидуальному курсу, чтение карточки и списка.
 * Ошибка базы наблюдение не роняет — оно вспомогательное к самой операции.
 */
export async function syncWatch(accountId: string, r: ExchangeRequest): Promise<void> {
  try {
    if (isTerminal(r.status)) {
      // финал, увиденный самим человеком: наблюдать больше нечего
      await db.delete(watchedRequests).where(eq(watchedRequests.requestId, r.requestId));
      return;
    }
    const status = watchStatus(r);
    await db
      .insert(watchedRequests)
      .values({
        requestId: r.requestId,
        accountId,
        status,
        needsConfirm: r.needsClientConfirmation,
        isIndividual: r.isIndividual ?? false,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: watchedRequests.requestId,
        set: {
          status,
          needsConfirm: r.needsClientConfirmation,
          updatedAt: new Date(),
        },
        // без лишних записей: строка трогается только при реальном изменении
        setWhere: sql`${watchedRequests.status} <> ${status} or ${watchedRequests.needsConfirm} <> ${r.needsClientConfirmation}`,
      });
  } catch (e) {
    console.warn('[watch] синхронизация наблюдения не удалась', (e as Error).message);
  }
}

/** Синхронизация списком — та же логика на каждую заявку страницы. */
export async function syncWatchMany(accountId: string, list: ExchangeRequest[]): Promise<void> {
  for (const r of list) await syncWatch(accountId, r);
}
