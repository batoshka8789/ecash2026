import 'server-only';

/**
 * Приведение «сырых» значений upstream к надёжным типам.
 * Курсы приходят строками ("539.40"), даты — ISO без гарантии суффикса Z.
 */

/** '539,40' | '539.40' | 539 | null → число. Никогда не NaN. */
export function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[\s ]/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

export function int(v: unknown): number | null {
  const n = num(v, NaN);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

/**
 * ISO-строка с гарантированной таймзоной. Upstream отдаёт UTC, но
 * '2026-07-25T10:00:00' без Z браузер разобрал бы как локальное время —
 * в Астане (UTC+5) это сместило бы каждый таймер на 5 часов.
 */
export function iso(v: unknown): string | null {
  if (typeof v !== 'string' || !v) return null;
  const hasTz = /(?:Z|[+-]\d{2}:?\d{2})$/.test(v);
  const s = hasTz ? v : `${v}Z`;
  return Number.isNaN(Date.parse(s)) ? null : s;
}

// ---------------------------------------------------------------- координаты

/** Ограничивающий прямоугольник Казахстана. */
const KZ = { latMin: 40.0, latMax: 56.0, lonMin: 46.0, lonMax: 88.0 };

const inKz = (lat: number, lon: number) =>
  lat >= KZ.latMin && lat <= KZ.latMax && lon >= KZ.lonMin && lon <= KZ.lonMax;

const warned = new Set<string>();

/**
 * depInfo отдаёт lat/lon ПЕРЕПУТАННЫМИ (Алматы: lat=76.85, lon=43.24 —
 * проверено вживую). Нормализуем через bbox Казахстана: если пара валидна
 * в перевёрнутом виде — переворачиваем; вне страны — отбрасываем, не гадаем.
 * Эвристика безопасна и после починки на бэкенде.
 */
export function normalizeCoords(
  rawLat: unknown,
  rawLon: unknown,
  depId?: number,
): { lat: number; lon: number } | null {
  const a = num(rawLat, NaN);
  const b = num(rawLon, NaN);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (inKz(a, b)) return { lat: a, lon: b };
  if (inKz(b, a)) {
    const key = String(depId ?? `${a},${b}`);
    if (!warned.has(key)) {
      warned.add(key);
      console.warn(`[ecash] depId=${depId ?? '?'}: lat/lon перепутаны, переворачиваю`);
    }
    return { lat: b, lon: a };
  }
  return null;
}
