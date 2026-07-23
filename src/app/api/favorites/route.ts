import { db } from '@/server/db';
import { ownerKey } from '@/server/session';
import { body, fail, ok } from '@/server/http';

/** Переключает валюту в избранном (иконка-закладка в строке курса). */
export async function POST(req: Request) {
  const data = await body<{ code?: string }>(req);
  if (!data?.code) return fail('code обязателен');

  const key = await ownerKey();
  const set = db.favorites.get(key) ?? new Set<string>();
  if (set.has(data.code)) set.delete(data.code);
  else set.add(data.code);
  db.favorites.set(key, set);

  return ok({ favorites: [...set] });
}
