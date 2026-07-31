/**
 * Единый порядок валют в списках выбора.
 *
 * Апстрим Ecash отдаёт валюты в порядке, своём у КАЖДОГО отделения: в одном
 * первым идёт USD, в другом RUB, а золотые слитки могут оказаться сразу
 * после тенге (заказчик прислал именно такой скриншот: KZT, GOLD1, GOLD5,
 * GOLD10…). Для клиента это выглядит случайной перестановкой, поэтому
 * порядок задаём сами и одинаковый везде:
 *
 *   1) KZT — тенге всегда первым (базовая валюта пары);
 *   2) ходовые валюты в привычном для обменника порядке;
 *   3) остальные — по алфавиту кода;
 *   4) золото — всегда в конце, по возрастанию веса слитка.
 */

/** Ходовые валюты в порядке востребованности в обменнике. */
const PRIORITY = [
  'KZT',
  'USD',
  'EUR',
  'RUB',
  'CNY',
  'GBP',
  'AED',
  'TRY',
  'KGS',
  'UZS',
] as const;

const GOLD_RE = /^GOLD(\d+)$/;

/** Вес для сортировки: меньше — выше в списке. */
function rank(code: string): number {
  const priority = PRIORITY.indexOf(code as (typeof PRIORITY)[number]);
  if (priority !== -1) return priority;
  if (GOLD_RE.test(code)) return 3000;
  return 1000;
}

/** Стабильно сортирует коды валют для выпадающих списков. */
export function sortCurrencyCodes<T extends string>(codes: readonly T[]): T[] {
  return [...codes].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;

    const ga = GOLD_RE.exec(a);
    const gb = GOLD_RE.exec(b);
    // золото — по весу слитка, а не по алфавиту («GOLD10» < «GOLD5» строкой)
    if (ga && gb) return Number(ga[1]) - Number(gb[1]);

    return a.localeCompare(b);
  });
}
