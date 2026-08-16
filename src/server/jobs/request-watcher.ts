import 'server-only';
import { eq, lt } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { watchedRequests } from '@/server/db/schema';
import { getRequest } from '@/server/ecash/endpoints/reserve';
import { EcashError } from '@/server/ecash/errors';
import { cachedUserToken, forgetUserToken } from '@/server/token-cache';
import { sendToAccounts } from '@/server/push';
import { requestEventText } from '@/server/push-text';
import { isTerminal, watchEvents, type WatchState } from '@/server/request-watch';

/**
 * Наблюдатель заявок: замечает решения казначея, пока человека нет на сайте,
 * и доставляет их push-ом.
 *
 * Почему опрос, а не события: живые события Ecash (SignalR) не проходят их
 * прокси (HANDOFF 9.3), а сервисному токену ядро не отдаёт заявки — 403,
 * проверено. Остаётся пользовательский токен из короткого кеша в памяти
 * (token-cache.ts): пока он жив (~15 минут после последнего действия),
 * наблюдатель может читать заявки этого человека.
 *
 * Минута между проходами — компромисс: казначей отвечает за минуты, а бронь
 * живёт 30, так что задержка в минуту погоды не делает; чаще — лишние
 * запросы к ядру на каждый проход по каждой заявке.
 */

const INTERVAL_MS = 60_000;
/** Заявки старше суток не наблюдаем: бронь живёт 30 минут, индивидуальный курс — часы. */
const MAX_AGE_MS = 24 * 60 * 60_000;

const g = globalThis as unknown as { __ecashRequestWatcher?: ReturnType<typeof setInterval> };

export async function watchTick(): Promise<void> {
  try {
    // прибираем то, что уже никогда не изменится или протухло
    await db
      .delete(watchedRequests)
      .where(lt(watchedRequests.createdAt, new Date(Date.now() - MAX_AGE_MS)));

    const rows = await db.select().from(watchedRequests);
    for (const row of rows) {
      const token = cachedUserToken(row.accountId);
      // токен истёк — человек давно ушёл; строка ждёт его возвращения
      // (любой его запрос обновит кеш) или суточной уборки
      if (!token) continue;

      let live;
      try {
        live = await getRequest(token, row.requestId);
      } catch (e) {
        if (e instanceof EcashError && e.httpStatus === 401) {
          // ядро отвергло токен раньше срока — не долбить им весь проход
          forgetUserToken(row.accountId);
        } else if (e instanceof EcashError && e.httpStatus === 404) {
          await db.delete(watchedRequests).where(eq(watchedRequests.requestId, row.requestId));
        }
        continue; // сетевые сбои — просто до следующего прохода
      }

      const prev: WatchState = { status: row.status, needsConfirm: row.needsConfirm };
      const next: WatchState = { status: live.status, needsConfirm: live.needsClientConfirmation };
      const events = watchEvents(prev, next);

      for (const event of events) {
        try {
          const sent = await sendToAccounts([row.accountId], (locale) => ({
            ...requestEventText(locale, event, live),
            url: `/requests/${row.requestId}`,
            tag: `req-${row.requestId}`,
          }));
          console.warn(`[watch] заявка ${row.requestId}: ${event}, push на ${sent} устройств`);
        } catch (e) {
          // недоставленный push не должен останавливать наблюдение
          console.warn('[watch] push не ушёл', (e as Error).message);
        }
      }

      // фиксируем увиденное ПОСЛЕ отправки: упади мы между чтением и записью,
      // следующий проход отправит то же событие снова — лучше редкий дубль,
      // чем молча потерянное «бронь подтверждена»
      if (isTerminal(live.status)) {
        await db.delete(watchedRequests).where(eq(watchedRequests.requestId, row.requestId));
      } else if (events.length > 0) {
        await db
          .update(watchedRequests)
          .set({ status: live.status, needsConfirm: live.needsClientConfirmation, updatedAt: new Date() })
          .where(eq(watchedRequests.requestId, row.requestId));
      }
    }
  } catch (e) {
    console.warn('[watch] проход не удался', (e as Error).message);
  }
}

export function startRequestWatcher(): void {
  if (g.__ecashRequestWatcher) return;
  g.__ecashRequestWatcher = setInterval(() => void watchTick(), INTERVAL_MS);
}
