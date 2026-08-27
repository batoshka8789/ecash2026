/**
 * Общая логика статуса отделения — расстояние, «Открыто/Закрыто», бейджи
 * («Самый выгодный», «Happy hours», «Ближе всего»). Раньше жила только в
 * Branches.tsx (/locations); карточка отделения в брони (PairFields.tsx)
 * использует те же формулы, чтобы бейдж/статус не разъезжались между
 * экранами для одного и того же отделения.
 */

export type GeoPoint = { lat: number; lon: number };

/** Расстояние по большому кругу, км. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Текущее время HH:mm в часовом поясе отделений (Asia/Almaty). */
export const almatyTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Almaty',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Открыто ли по расписанию: строки HH:mm сравниваются лексикографически;
 *  closeTime '23:59' означает «до полуночи», open > close — ночной график. */
export function isOpenNow(tt: { openTime: string; closeTime: string }, hhmm: string): boolean {
  if (tt.openTime <= tt.closeTime) return hhmm >= tt.openTime && hhmm <= tt.closeTime;
  return hhmm >= tt.openTime || hhmm <= tt.closeTime;
}

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Минут до закрытия по расписанию; ночной график (open > close) учитывается
 *  через модуль суток. Осмыслен только пока отделение открыто (isOpenNow) —
 *  вне часов работы «сколько осталось» не имеет смысла. */
export function minutesToClose(tt: { openTime: string; closeTime: string }, hhmm: string): number {
  return (toMinutes(tt.closeTime) - toMinutes(hhmm) + 1440) % 1440;
}

/** «Happy hours» — последние 2 часа перед закрытием, пока отделение открыто:
 *  вечернее окно, когда обменники традиционно дают выгодный курс постоянным
 *  клиентам. Это фронтовый дефолт до появления признака от бэкенда. */
export function isHappyHours(tt: { openTime: string; closeTime: string }, hhmm: string): boolean {
  if (!isOpenNow(tt, hhmm)) return false;
  return minutesToClose(tt, hhmm) <= 120;
}

/** Бейджи отделения: цвета из палитры макета (badge, 12/700, r8).
 *  bestBuy/bestSale — для /locations, где Покупка и Продажа видны в одной
 *  строке одновременно и могут быть выгодны в РАЗНЫХ отделениях: один
 *  общий «best» было не различить, кто именно выгоднее — на покупку или
 *  на продажу. Отдельный «best» остаётся для карточки брони (PairFields/
 *  BookingFlow) — там на экране только одна сторона сделки, и бейдж
 *  однозначен без уточнения. */
export const badgeStyles = {
  best: 'bg-brand',
  bestBuy: 'bg-brand',
  bestSale: 'bg-brand',
  happyHours: 'bg-additional-2',
  nearest: 'bg-additional-3',
} as const;

export type BadgeKind = keyof typeof badgeStyles;
