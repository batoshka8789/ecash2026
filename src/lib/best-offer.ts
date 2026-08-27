/**
 * Лучшее предложение по сети/городу — СВОЙ расчёт по курсам отделений.
 *
 * Почему не апстримный /mobile/rates/best-rate, который для этого и
 * существует: его поля bestBuy/bestSale названы в семантике КЛИЕНТА
 * («лучшее, чтобы купить» / «лучшее, чтобы продать»), а не обменника, и
 * без документации это неразличимо — читается ровно наоборот. Живая
 * проверка (27.08.2026, боевой контур, USD/Алматы): у отделения FORUM
 * depId 4 реальные buy 460,5 и sell 463,5, а best-rate по нему отдаёт
 * bestBuy.rate = 463,5 (это его sell) и bestSale.rate = 460,5 (это buy).
 * Из-за этой развилки плашка «дешевле купить» обещала курс покупки
 * обменника, а после переключения экран показывал курс продажи — разные
 * числа на одном экране, и «выгода» иногда оказывалась ухудшением.
 *
 * Здесь лучшее предложение считается из тех же buy/sell, которыми
 * нарисованы колонки «Покупка»/«Продажа» в списке отделений и поле
 * «Текущий курс» в брони. Совпадение обещанного и показанного получается
 * не по договорённости с чужим API, а по построению: источник один.
 *
 * Направление — всегда с точки зрения КЛИЕНТА:
 *  • buying  — клиент ПОКУПАЕТ валюту, платит тенге. Ему нужен наименьший
 *    курс продажи обменника (sell): чем меньше тенге за единицу, тем лучше.
 *  • selling — клиент ПРОДАЁТ валюту, получает тенге. Нужен наибольший
 *    курс покупки обменника (buy): чем больше тенге за единицу, тем лучше.
 */

/** Отделение с курсом одной валюты — минимум, нужный для расчёта. */
export type BranchRate = {
  depId: number;
  /** каноничный город (см. canonicalCity) — по нему сужаем поиск */
  city: string | null;
  address: string;
  /** курс покупки валюты обменником у клиента */
  buy: number;
  /** курс продажи валюты обменником клиенту */
  sell: number;
};

export type BestOffer = { depId: number; address: string; rate: number };

/** Клиент покупает валюту или продаёт её — от этого зависит, что «лучше». */
export type OfferSide = 'buying' | 'selling';

/**
 * Курс, по которому пройдёт сделка в этом отделении для данной стороны.
 * Ноль означает «этой валюты здесь нет» — такие отделения в расчёт не
 * берутся вовсе, иначе минимум по sell всегда был бы нулём.
 */
export function rateForSide(row: BranchRate, side: OfferSide): number {
  return side === 'buying' ? row.sell : row.buy;
}

/** Лучше ли `candidate` чем `current` для этой стороны сделки. */
export function isBetterRate(side: OfferSide, candidate: number, current: number): boolean {
  if (candidate <= 0 || current <= 0) return false;
  return side === 'buying' ? candidate < current : candidate > current;
}

/**
 * Лучшее предложение среди отделений (опционально — только в одном городе).
 *
 * При равных курсах побеждает меньший depId: порядок должен быть
 * устойчивым, иначе плашка «выгоднее» скакала бы между одинаковыми
 * отделениями на каждом перезапросе.
 */
export function bestOffer(
  rows: BranchRate[],
  side: OfferSide,
  city?: string | null,
): BestOffer | null {
  let best: BranchRate | null = null;
  let bestRate = 0;

  for (const row of rows) {
    if (city && row.city !== city) continue;
    const rate = rateForSide(row, side);
    if (rate <= 0) continue;
    if (best === null || isBetterRate(side, rate, bestRate) || (rate === bestRate && row.depId < best.depId)) {
      best = row;
      bestRate = rate;
    }
  }

  return best === null ? null : { depId: best.depId, address: best.address, rate: bestRate };
}
