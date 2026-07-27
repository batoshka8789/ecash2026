import { NextRequest } from 'next/server';
import { rateLimited } from '@/server/api/guard';
import { fail, ok } from '@/server/api/respond';

/**
 * Геокодирование адреса пользователя («Мой адрес» → точка на карте и поиск
 * ближайшего отделения). Внешних платных геокодеров у проекта нет —
 * используем OSM Nominatim (бесплатный, для наших единичных запросов его
 * правил использования достаточно) через BFF: браузер наружу не ходит,
 * ответы кешируются в памяти процесса, есть таймаут и жёсткий формат ответа.
 */

const CACHE = new Map<string, { lat: number; lon: number } | null>();
const MAX_CACHE = 500;

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 200);
  if (q.length < 4) return fail('errors.badBody');

  const key = q.toLowerCase();
  if (CACHE.has(key)) return ok({ point: CACHE.get(key) });

  // лимит ТОЛЬКО на кеш-промахи: без него любой цикл с уникальными q
  // транслируется прямо в Nominatim (их политика — max 1 rps) и роняет
  // геокодер для всех; 10 новых адресов в минуту на IP хватает с запасом
  if (rateLimited(req, 'geocode', 10, 60_000)) return fail('errors.tooManyRequests', 429);

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'kz');
  url.searchParams.set('accept-language', 'ru');

  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'ecash-exchange-site/1.0 (contact: info@ecash.kz)' },
      signal: AbortSignal.timeout(6000),
      // Nominatim просит кешировать — час на стороне Next более чем ок
      next: { revalidate: 3600 },
    });
    if (!res.ok) return ok({ point: null });
    const rows = (await res.json()) as { lat?: string; lon?: string }[];
    const first = rows?.[0];
    const lat = first ? Number(first.lat) : NaN;
    const lon = first ? Number(first.lon) : NaN;
    const point = Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;

    // вытесняем самый старый ключ, а не сбрасываем весь кеш: иначе флуд
    // уникальными адресами выбивал бы и горячие адреса реальных пользователей
    if (CACHE.size >= MAX_CACHE) {
      const oldest = CACHE.keys().next().value;
      if (oldest !== undefined) CACHE.delete(oldest);
    }
    CACHE.set(key, point);
    return ok({ point });
  } catch {
    // геокодер недоступен — фича деградирует молча, без ошибки в UI
    return ok({ point: null });
  }
}
