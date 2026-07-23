import { destroySession } from '@/server/session';
import { ok } from '@/server/http';

export async function POST() {
  await destroySession();
  return ok({ ok: true });
}
