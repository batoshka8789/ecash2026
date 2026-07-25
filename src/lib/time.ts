/**
 * Серверное время для денежных таймеров. Каждый ответ BFF несёт X-Server-Time;
 * храним смещение и считаем обратный отсчёт от serverNow(), а не от локальных
 * часов — сбитые часы клиента не могут «истечь» бронь раньше времени.
 */

let skewMs = 0;

export function noteServerTime(header: string | null): void {
  if (!header) return;
  const t = Date.parse(header);
  if (!Number.isNaN(t)) skewMs = t - Date.now();
}

/** Текущее серверное время, epoch ms. */
export const serverNow = () => Date.now() + skewMs;

/** Остаток до ISO-срока в секундах, не меньше нуля. */
export function secondsLeft(untilIso: string | null): number {
  if (!untilIso) return 0;
  return Math.max(0, Math.floor((Date.parse(untilIso) - serverNow()) / 1000));
}
