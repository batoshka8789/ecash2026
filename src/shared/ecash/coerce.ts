
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

/*
  Одно предупреждение на процесс/вкладку, а не на каждое отделение.
  Своп координат у Ecash системный — перевёрнуты все 20 отделений, поэтому
  подробность «depId=N» ничего не добавляла, зато с переездом мапперов в
  браузер эти строки стали печататься на КАЖДУЮ загрузку страницы двадцатью
  жёлтыми предупреждениями подряд. Оставляем один факт.
*/
let swapWarned = false;

/**
 * depInfo отдаёт lat/lon ПЕРЕПУТАННЫМИ (Алматы: lat=76.85, lon=43.24 —
 * проверено вживую, все 20 отделений). Нормализуем через bbox Казахстана:
 * если пара валидна в перевёрнутом виде — переворачиваем; вне страны —
 * отбрасываем, не гадаем. Эвристика безопасна и после починки на бэкенде.
 *
 * bbox по широте (40–56) и долготе (46–88) у Казахстана пересекается в
 * полосе 46–56: у западных областей (Атырау ≈47/52, Актобе ≈50/57) ОБА
 * порядка читаются как «в Казахстане» — inKz(a,b) и inKz(b,a) одновременно
 * true. Раньше в этом случае побеждала первая проверка и функция молча
 * доверяла сырому порядку, хотя upstream ломает координаты СИСТЕМНО и без
 * исключений — отделение из этой полосы получало неперевёрнутые (то есть
 * на деле неверные) координаты без единого предупреждения. Раз бэкенд
 * подтверждённо переворачивает всё подряд, в неоднозначном случае тоже
 * доверяем свопу — и не молчим об этом.
 */
export function normalizeCoords(
  rawLat: unknown,
  rawLon: unknown,
): { lat: number; lon: number } | null {
  const a = num(rawLat, NaN);
  const b = num(rawLon, NaN);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

  const originalOk = inKz(a, b);
  const swappedOk = inKz(b, a);

  if (originalOk && !swappedOk) return { lat: a, lon: b };
  if (swappedOk) {
    if (!swapWarned) {
      swapWarned = true;
      console.warn(
        '[ecash] координаты отделений приходят перевёрнутыми (lat↔lon) — переворачиваю. ' +
          'Сообщение выводится один раз за сессию.',
      );
    }
    return { lat: b, lon: a };
  }
  return null;
}
