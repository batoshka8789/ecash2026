import { currentUser } from '@/server/session';
import { ok } from '@/server/http';

export async function GET() {
  return ok({ user: await currentUser() });
}
