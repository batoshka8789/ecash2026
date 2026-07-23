import { db, newId } from '@/server/db';
import { currentUser } from '@/server/session';
import { body, fail, ok } from '@/server/http';
import type { CurrencyCode, Subscription } from '@/lib/types';

export async function GET() {
  const user = await currentUser();
  return ok({
    subscriptions: db.subscriptions.filter((s) => s.userId === (user?.id ?? null)),
  });
}

/** Подписка «Уведомить об изменении курса»: целевой курс + дата до. */
export async function POST(req: Request) {
  const data = await body<{
    from?: CurrencyCode;
    to?: CurrencyCode;
    targetRate?: number;
    day?: string;
    month?: string;
    year?: string;
  }>(req);

  const targetRate = Number(data?.targetRate);
  if (!Number.isFinite(targetRate) || targetRate <= 0)
    return fail('errors.rateRequired', 400, 'targetRate');
  if (!data?.day) return fail('errors.dateRequired', 400, 'day');
  if (!data?.month) return fail('errors.dateRequired', 400, 'month');
  if (!data?.year) return fail('errors.dateRequired', 400, 'year');

  const user = await currentUser();
  const sub: Subscription = {
    id: newId(),
    userId: user?.id ?? null,
    from: data.from ?? 'KZT',
    to: data.to ?? 'USD',
    targetRate,
    until: `${data.day}.${data.month}.${data.year}`,
    active: true,
    createdAt: Date.now(),
  };
  db.subscriptions.unshift(sub);

  if (user) {
    db.notifications.unshift({
      id: newId(),
      userId: user.id,
      badges: ['rateAlert'],
      titleKey: 'alertsOn',
      createdAt: Date.now(),
      read: false,
      archived: false,
      side: 'buy',
      amount: `${targetRate} (₸) : 1 ($)`,
      actions: [],
    });
  }

  return ok({ subscription: sub }, { status: 201 });
}
