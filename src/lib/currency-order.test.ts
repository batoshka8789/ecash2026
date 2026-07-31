import { describe, expect, it } from 'vitest';
import { sortCurrencyCodes } from './currency-order';

describe('sortCurrencyCodes', () => {
  it('тенге первым, золото последним — как в жалобе заказчика', () => {
    // именно этот порядок пришёл от апстрима на скриншоте
    const got = sortCurrencyCodes(['KZT', 'GOLD1', 'GOLD5', 'GOLD10', 'USD', 'EUR']);
    expect(got).toEqual(['KZT', 'USD', 'EUR', 'GOLD1', 'GOLD5', 'GOLD10']);
  });

  it('золото сортируется по весу слитка, а не по строке', () => {
    const got = sortCurrencyCodes(['GOLD100', 'GOLD5', 'GOLD20', 'GOLD1', 'GOLD50', 'GOLD10']);
    expect(got).toEqual(['GOLD1', 'GOLD5', 'GOLD10', 'GOLD20', 'GOLD50', 'GOLD100']);
  });

  it('ходовые валюты идут в заданном порядке, остальные — по алфавиту', () => {
    const got = sortCurrencyCodes(['THB', 'RUB', 'AED', 'CZK', 'USD', 'JPY']);
    expect(got).toEqual(['USD', 'RUB', 'AED', 'CZK', 'JPY', 'THB']);
  });

  it('порядок не зависит от того, как валюты пришли от отделения', () => {
    const depA = ['USD', 'SEK', 'CNY', 'RUB', 'KGS', 'UZS'];
    const depB = ['RUB', 'KGS', 'CNY', 'UZS', 'SEK', 'USD'];
    expect(sortCurrencyCodes(depA)).toEqual(sortCurrencyCodes(depB));
  });

  it('исходный массив не мутируется', () => {
    const src = ['USD', 'KZT'];
    sortCurrencyCodes(src);
    expect(src).toEqual(['USD', 'KZT']);
  });
});
