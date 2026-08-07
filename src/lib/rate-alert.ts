/**
 * Правило срабатывания подписки «уведомить об изменении курса».
 *
 * Вынесено из снапшоттера в чистую функцию не ради красоты: раньше сравнение
 * жило прямо в SQL-условии и было ПЕРЕВЁРНУТО относительно собственного
 * комментария рядом. Подписка «сообщи, когда доллар подешевеет до 500»
 * срабатывала сразу при создании (курс продажи и так был выше цели), а когда
 * курс действительно доходил до 500 — молчала. Проверить это в SQL нечем,
 * поэтому правило теперь здесь и покрыто тестами.
 *
 * Направление закодировано порядком валютной пары — тем же, что в
 * бронировании (см. SubscribeFlow):
 *  • KZT→валюта — человек ПОКУПАЕТ. Ему важен курс ПРОДАЖИ обменника, и чем
 *    он ниже, тем лучше: цель достигнута, когда продажа опустилась
 *    до отметки или ниже.
 *  • валюта→KZT — человек ПРОДАЁТ. Важен курс ПОКУПКИ, и чем он выше, тем
 *    лучше: цель достигнута, когда покупка поднялась до отметки или выше.
 */

export type AlertDirection = 'buying' | 'selling';

/** Куда смотрит подписка, судя по порядку пары. */
export function alertDirection(currencyFrom: string, currencyTo: string): AlertDirection | null {
  if (currencyFrom === 'KZT' && currencyTo !== 'KZT') return 'buying';
  if (currencyTo === 'KZT' && currencyFrom !== 'KZT') return 'selling';
  return null;
}

/** Валюта, за курсом которой следит подписка (не тенге). */
export function alertCurrency(currencyFrom: string, currencyTo: string): string | null {
  const dir = alertDirection(currencyFrom, currencyTo);
  if (dir === 'buying') return currencyTo;
  if (dir === 'selling') return currencyFrom;
  return null;
}

/**
 * Достигнута ли отметка. `best` — лучший на рынке курс по этой валюте:
 * для покупателя минимальная продажа, для продавца максимальная покупка.
 * Ноль или отсутствие курса — не срабатывание, а отсутствие данных.
 */
export function alertReached(
  direction: AlertDirection,
  targetRate: number,
  best: number | undefined,
): boolean {
  if (!best || best <= 0 || !Number.isFinite(targetRate) || targetRate <= 0) return false;
  return direction === 'buying' ? best <= targetRate : best >= targetRate;
}
