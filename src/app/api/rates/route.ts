import { db, MARKET } from '@/server/db';
import { ownerKey } from '@/server/session';
import { ok } from '@/server/http';

/** Курсы валют + конкуренты + избранное текущего владельца. */
export async function GET() {
  const key = await ownerKey();
  return ok({
    marketRate: MARKET,
    currencies: db.currencies,
    competitors: db.competitors,
    favorites: [...(db.favorites.get(key) ?? new Set<string>())],
  });
}
