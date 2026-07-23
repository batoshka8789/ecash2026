import { db } from '@/server/db';
import { currentUser } from '@/server/session';
import { fail, ok } from '@/server/http';

/** ?tab=actual|history — соответствует табам «Актуальное» / «История». */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return fail('errors.unauthorized', 401);

  const tab = new URL(req.url).searchParams.get('tab') ?? 'actual';
  const mine = db.notifications.filter((n) => n.userId === user.id);
  const list = mine.filter((n) => (tab === 'history' ? n.archived : !n.archived));

  return ok({
    notifications: list.sort((a, b) => b.createdAt - a.createdAt),
    unread: mine.filter((n) => !n.read && !n.archived).length,
    bookings: db.bookings.filter((b) => b.userId === user.id),
  });
}

/** Отметить все прочитанными. */
export async function POST() {
  const user = await currentUser();
  if (!user) return fail('errors.unauthorized', 401);
  for (const n of db.notifications) if (n.userId === user.id) n.read = true;
  return ok({ ok: true });
}
