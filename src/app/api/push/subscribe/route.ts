import { NextResponse } from 'next/server';
import { withUser } from '@/server/api/guard';
import { body, fail, fromError, ok } from '@/server/api/respond';
import { readSession } from '@/server/session';
import { pushEnabled, removePushSubscription, savePushSubscription } from '@/server/push';
import { pushSubscribeBody, pushUnsubscribeBody } from '@/shared/schemas';

/**
 * Подписка и отписка браузера от push.
 *
 * Только для вошедших: уведомление привязано к подписке на курс, а она —
 * к аккаунту. Гостю уведомлять не о чем.
 */

export const POST = withUser(async (req) => {
  if (!pushEnabled) return fail('errors.pushDisabled', 503);

  const parsed = await body(req, pushSubscribeBody);
  if (parsed instanceof NextResponse) return parsed;

  const s = await readSession();
  try {
    await savePushSubscription({
      accountId: s!.accountId,
      endpoint: parsed.endpoint,
      p256dh: parsed.keys.p256dh,
      auth: parsed.keys.auth,
      // обрезаем: заголовок бывает очень длинным, а нужен он только чтобы
      // понять, с какого браузера пришла проблемная подписка
      userAgent: (req.headers.get('user-agent') ?? '').slice(0, 300),
    });
    return ok({ subscribed: true }, { status: 201 });
  } catch (e) {
    return fromError(e);
  }
});

export const DELETE = withUser(async (req) => {
  const parsed = await body(req, pushUnsubscribeBody);
  if (parsed instanceof NextResponse) return parsed;

  try {
    // Владельца не проверяем намеренно: endpoint выдаётся браузером, он у
    // каждого свой и не угадывается, а отписка — действие безобидное.
    // Зато так отписка срабатывает и когда сессия уже сменилась.
    await removePushSubscription(parsed.endpoint);
    return ok({ subscribed: false });
  } catch (e) {
    return fromError(e);
  }
});
