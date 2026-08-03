import { NextRequest } from 'next/server';
import { rateLimited } from '@/server/api/guard';
import { fail, ok } from '@/server/api/respond';

/**
 * Подсказки адреса по мере ввода («Укажите свой адрес») — 2GIS Suggest API
 * (catalog.api.2gis.com/3.0/suggests). Ключ ОТДЕЛЬНЫЙ от NEXT_PUBLIC_DGIS_API_KEY
 * (тот — для MapGL JS API в браузере, этот — для Suggest/Places API на
 * сервере, оба выдаются на platform.2gis.ru как разные продукты).
 * Раньше здесь был OSM Nominatim — сменили на 2GIS ради покрытия по КЗ.
 */

type Suggestion = { label: string; lat: number; lon: number };

type DgisAdmDiv = { name?: string; type?: string };

type DgisItem = {
  name?: string;
  address_name?: string;
  full_address_name?: string;
  point?: string | { lat?: number; lon?: number };
  adm_div?: DgisAdmDiv[];
};

/** Тот же прямоугольник Казахстана, что и в normalizeCoords (coerce.ts) — ограничивает подсказки регионом. */
const KZ_VIEWPOINT1 = '46,56';
const KZ_VIEWPOINT2 = '88,40';

function resolveCity(admDiv: DgisAdmDiv[] | undefined): string | undefined {
  return admDiv?.find((d) => d.type === 'adm_div.city' || d.type === 'adm_div.settlement')?.name;
}

/** `point` документирован как строка «lon,lat», но подстраховываемся и под объектную форму. */
function parsePoint(point: DgisItem['point']): { lat: number; lon: number } | null {
  if (!point) return null;
  if (typeof point === 'object') {
    const lat = Number(point.lat);
    const lon = Number(point.lon);
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
  }
  const [lonStr, latStr] = point.split(',');
  const lon = Number(lonStr);
  const lat = Number(latStr);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

/** «Город, <остальная адресная часть>» — город выносим вперёд и убираем из хвоста, порядок остального не трогаем. */
function formatAddress(item: DgisItem): string {
  const raw = item.full_address_name || item.address_name || item.name || '';
  const city = resolveCity(item.adm_div);
  if (!city) return raw;

  const strip = new Set([city, ...(item.adm_div ?? []).map((d) => d.name).filter((n): n is string => Boolean(n))]);
  const rest = raw
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p && !strip.has(p));

  return rest.length > 0 ? [city, ...rest].join(', ') : city;
}

const CACHE = new Map<string, Suggestion[]>();
const MAX_CACHE = 500;
const LIMIT = 6;

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 200);
  if (q.length < 3) return ok({ suggestions: [] });

  // Ключа нет — подсказки молча пустеют, поле остаётся рабочим (та же
  // деградация, что и у карты без NEXT_PUBLIC_DGIS_API_KEY, см. dgis.ts).
  const key = process.env.DGIS_SUGGEST_API_KEY;
  if (!key) return ok({ suggestions: [] });

  const cacheKey = q.toLowerCase();
  if (CACHE.has(cacheKey)) return ok({ suggestions: CACHE.get(cacheKey) });

  if (rateLimited(req, 'geocode-suggest', 20, 60_000)) {
    return fail('errors.tooManyRequests', 429);
  }

  const url = new URL('https://catalog.api.2gis.com/3.0/suggests');
  url.searchParams.set('q', q);
  url.searchParams.set('key', key);
  url.searchParams.set('suggest_type', 'address');
  url.searchParams.set('viewpoint1', KZ_VIEWPOINT1);
  url.searchParams.set('viewpoint2', KZ_VIEWPOINT2);
  url.searchParams.set('locale', 'ru_RU');
  url.searchParams.set('fields', 'items.point,items.adm_div');
  url.searchParams.set('page_size', String(LIMIT));

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return ok({ suggestions: [] });
    const data = (await res.json()) as { result?: { items?: DgisItem[] } };

    const suggestions: Suggestion[] = (data.result?.items ?? [])
      .map((item) => {
        const point = parsePoint(item.point);
        return point ? { label: formatAddress(item), lat: point.lat, lon: point.lon } : null;
      })
      .filter((s): s is Suggestion => Boolean(s?.label));

    if (CACHE.size >= MAX_CACHE) {
      const oldest = CACHE.keys().next().value;
      if (oldest !== undefined) CACHE.delete(oldest);
    }
    CACHE.set(cacheKey, suggestions);
    return ok({ suggestions });
  } catch {
    return ok({ suggestions: [] });
  }
}
