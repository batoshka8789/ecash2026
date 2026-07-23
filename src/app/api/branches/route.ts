import { db } from '@/server/db';
import { ok } from '@/server/http';

/** Отделения Ecash. ?sort=distance — по удалённости, как в макете. */
export async function GET(req: Request) {
  const sort = new URL(req.url).searchParams.get('sort');
  const list = [...db.branches];
  if (sort === 'distance') list.sort((a, b) => a.distanceKm - b.distanceKm);
  return ok({ branches: list });
}
