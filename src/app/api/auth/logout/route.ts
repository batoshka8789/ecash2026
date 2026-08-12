import { checkOrigin } from '@/server/api/guard';
import { ok } from '@/server/api/respond';
import { logout } from '@/server/ecash/endpoints/auth';
import { destroySession, readSession } from '@/server/session';

export async function POST(req: Request) {
  const originErr = checkOrigin(req);
  if (originErr) return originErr;

  const s = await readSession();
  if (s) {
    // отзываем токены upstream; сбой не мешает локальному выходу
    await logout(s.accessToken).catch(() => {});
  }
  await destroySession();
  return ok({ ok: true });
}
