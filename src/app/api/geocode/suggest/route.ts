import { NextRequest } from 'next/server';
import { rateLimited } from '@/server/api/guard';
import { fail, ok } from '@/server/api/respond';

/**
 * Подсказки адреса по мере ввода («Укажите свой адрес») — реальные
 * казахстанские адреса, а не substring-фильтр по адресам отделений
 * (тот остаётся отдельным списком «избранного» для пустого поля,
 * см. useAddressSuggestions). Тот же провайдер и тот же BFF-приём, что
 * у /api/geocode: OSM Nominatim, countrycodes=kz, кеш в памяти процесса.
 */

type Suggestion = { label: string; lat: number; lon: number };

/** Подмножество полей `address` из ответа Nominatim (addressdetails=1), которое нас интересует. */
type NominatimAddress = {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state_district?: string;
  state?: string;
  postcode?: string;
  country?: string;
};

/** Город — сам населённый пункт, а при его отсутствии (мелкий н.п.) — район/область по убыванию. */
function resolveCity(a: NominatimAddress): string | undefined {
  return a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? a.state_district ?? a.state;
}

/**
 * «Город, <остальная адресная часть — как её вернул Nominatim>».
 *
 * НЕ собираем адрес вручную из типизированных полей (`road`+`house_number`):
 * адрес — не всегда «улица и дом», бывают ЖК, микрорайоны, кварталы,
 * корпуса и т.п., для которых у Nominatim нет отдельных типизированных
 * полей вообще — они есть только внутри готовой строки `display_name`.
 * Поэтому берём её как есть и просто убираем административный хвост
 * (город — раз он уже вынесен вперёд отдельно, — область/район/индекс/
 * страна): порядок и состав ОСТАЛЬНЫХ компонентов не трогаем.
 */
function formatAddress(a: NominatimAddress, displayName: string): string {
  const city = resolveCity(a);
  const strip = new Set(
    [city, a.state, a.state_district, a.county, a.postcode, a.country].filter(
      (v): v is string => Boolean(v),
    ),
  );
  const rest = displayName
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p && !strip.has(p));

  if (!city) return rest.join(', ') || displayName;
  return [city, ...rest].join(', ');
}

const CACHE = new Map<string, Suggestion[]>();
const MAX_CACHE = 500;
const LIMIT = 6;

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 200);
  if (q.length < 3) return ok({ suggestions: [] });

  const key = q.toLowerCase();
  if (CACHE.has(key)) return ok({ suggestions: CACHE.get(key) });

  // тот же бюджет, что и у /api/geocode: лимит только на кеш-промахи
  if (rateLimited(req, 'geocode-suggest', 20, 60_000)) {
    return fail('errors.tooManyRequests', 429);
  }

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', String(LIMIT));
  url.searchParams.set('countrycodes', 'kz');
  url.searchParams.set('accept-language', 'ru');
  url.searchParams.set('addressdetails', '1');

  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'ecash-exchange-site/1.0 (contact: info@ecash.kz)' },
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return ok({ suggestions: [] });
    const rows = (await res.json()) as {
      display_name?: string;
      address?: NominatimAddress;
      lat?: string;
      lon?: string;
    }[];
    const suggestions: Suggestion[] = rows
      .map((r) => ({
        label: formatAddress(r.address ?? {}, r.display_name ?? ''),
        lat: Number(r.lat),
        lon: Number(r.lon),
      }))
      .filter((s) => s.label && Number.isFinite(s.lat) && Number.isFinite(s.lon));

    if (CACHE.size >= MAX_CACHE) {
      const oldest = CACHE.keys().next().value;
      if (oldest !== undefined) CACHE.delete(oldest);
    }
    CACHE.set(key, suggestions);
    return ok({ suggestions });
  } catch {
    // геокодер недоступен — подсказки молча пустеют, поле остаётся рабочим
    return ok({ suggestions: [] });
  }
}
