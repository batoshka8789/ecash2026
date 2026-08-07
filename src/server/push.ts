import 'server-only';
import webpush from 'web-push';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { pushSubscriptions } from '@/server/db/schema';
import { env } from '@/server/env';

/**
 * Браузерные push-уведомления (Web Push, VAPID).
 *
 * Зачем вообще: подписка «уведомить об изменении курса» до сих пор только
 * ставила отметку в базе — человек узнавал о достижении курса, лишь когда сам
 * заходил на сайт. Push доставляет это в момент события, даже если вкладка
 * закрыта.
 *
 * Почему не SMS: у Ecash в API нет отправки произвольных SMS (только OTP),
 * а сторонний шлюз — это договор и деньги за каждое сообщение. Web Push
 * бесплатен и работает через сам браузер.
 *
 * Ключи опциональны: без них push просто выключен, остальной сайт живёт
 * как раньше. Это важно для стендов и для CI, где ключей нет.
 */

export const pushEnabled = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

if (pushEnabled) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
}

/** Полезная нагрузка. Ровно то, что читает служебный воркер (public/sw.js). */
export type PushPayload = {
  title: string;
  body: string;
  /** куда вести по клику; путь внутри сайта */
  url: string;
  /**
   * Метка для схлопывания. Уведомления с одной меткой заменяют друг друга,
   * а не копятся стопкой: две сработавшие подписки на доллар — это одно
   * актуальное сообщение, а не два.
   */
  tag: string;
};

/**
 * Отправка на все устройства аккаунтов. Возвращает, сколько сообщений ушло.
 *
 * Мёртвые подписки (404/410 — браузер удалён, разрешение отозвано) чистим
 * сразу: иначе их накапливается больше, чем живых, и каждый проход
 * снапшоттера тратит время на заведомо провальные запросы.
 */
export async function sendToAccounts(
  accountIds: string[],
  payload: PushPayload,
): Promise<number> {
  if (!pushEnabled || accountIds.length === 0) return 0;

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.accountId, accountIds));
  if (subs.length === 0) return 0;

  const body = JSON.stringify(payload);
  const dead: string[] = [];
  let sent = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          // сутки: если телефон был выключен, уведомление всё равно догонит,
          // но протухший курс через сутки уже никому не нужен
          { TTL: 86_400 },
        );
        sent += 1;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(s.endpoint);
        else console.warn('[push] отправка не удалась', status, (e as Error).message);
      }
    }),
  );

  if (dead.length > 0) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, dead));
    console.warn(`[push] удалено мёртвых подписок: ${dead.length}`);
  }

  return sent;
}

/** Подписка браузера. Повторная с того же устройства обновляет строку. */
export async function savePushSubscription(input: {
  accountId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
}): Promise<void> {
  await db
    .insert(pushSubscriptions)
    .values(input)
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      // тот же браузер мог быть подписан под другим аккаунтом — перепривязываем
      set: {
        accountId: input.accountId,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent,
      },
    });
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}
