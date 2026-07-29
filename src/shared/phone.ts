/**
 * Сравнение телефонов. Upstream отдаёт `phoneNumber` в неизвестном формате
 * (`+77051112233`, `77051112233`, `8 705 …`), а человек в настройках стенда
 * пишет как ему удобно — поэтому сверяем по последним 10 цифрам,
 * то есть по национальному номеру без кода страны и без форматирования.
 */

export const phoneDigits = (phone: string): string => phone.replace(/\D/g, '');

/** Национальный номер: последние 10 цифр. Короче 10 — считаем невалидным. */
export const phoneKey = (phone: string): string => phoneDigits(phone).slice(-10);

export function samePhone(a: string, b: string): boolean {
  const ka = phoneKey(a);
  return ka.length === 10 && ka === phoneKey(b);
}
