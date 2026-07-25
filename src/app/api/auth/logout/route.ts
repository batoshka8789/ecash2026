import { checkOrigin } from '@/server/api/guard';
import { ok } from '@/server/api/respond';
import { logout } from '@/server/ecash/endpoints/auth';
import { destroySession, readSession } from '@/server/session';
import { isDemoToken } from '@/server/demo/store';

export async function POST(req: Request) {
  const originErr = checkOrigin(req);
  if (originErr) return originErr;

  const s = await readSession();
  if (s && !isDemoToken(s.accessToken)) {
    // отзываем токены upstream; сбой не мешает локальному выходу
    await logout(s.accessToken).catch(() => {});
  }
  await destroySession();
  return ok({ ok: true });
}
