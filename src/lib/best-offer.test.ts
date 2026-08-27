import { describe, expect, it } from 'vitest';
import { bestOffer, isBetterRate, rateForSide, type BranchRate } from './best-offer';

const row = (
  depId: number,
  buy: number,
  sell: number,
  city: string | null = 'Алматы',
): BranchRate => ({ depId, city, address: `адрес ${depId}`, buy, sell });

describe('rateForSide — какой курс участвует в сделке', () => {
  it('клиент покупает валюту — курс продажи обменника', () => {
    expect(rateForSide(row(1, 460, 464), 'buying')).toBe(464);
  });

  it('клиент продаёт валюту — курс покупки обменника', () => {
    expect(rateForSide(row(1, 460, 464), 'selling')).toBe(460);
  });
});

describe('isBetterRate — «лучше» считается с точки зрения клиента', () => {
  it('покупка: дешевле — лучше', () => {
    expect(isBetterRate('buying', 461, 464)).toBe(true);
    expect(isBetterRate('buying', 464, 461)).toBe(false);
  });

  it('продажа: дороже — лучше', () => {
    expect(isBetterRate('selling', 461, 460)).toBe(true);
    expect(isBetterRate('selling', 460, 461)).toBe(false);
  });

  it('равный курс не считается улучшением — плашка «выгоднее» не про ноль выгоды', () => {
    expect(isBetterRate('buying', 464, 464)).toBe(false);
    expect(isBetterRate('selling', 464, 464)).toBe(false);
  });

  it('нулевой курс — нет данных, а не бесконечная выгода', () => {
    expect(isBetterRate('buying', 0, 464)).toBe(false);
    expect(isBetterRate('selling', 464, 0)).toBe(false);
  });
});

describe('bestOffer', () => {
  /**
   * Живые данные боевого контура на момент инцидента 27.08.2026 (USD,
   * Алматы). Апстримный best-rate указывал по этому же набору курс 460,5
   * как «дешевле купить», хотя 460,5 — курс ПОКУПКИ обменника, а купить
   * клиент может минимум за 463,5. Именно это расхождение и всплывало на
   * экране: обещали одно число, после переключения показывали другое.
   */
  const almaty = [
    row(2, 460.3, 463.8),
    row(3, 460.1, 463.6),
    row(4, 460.5, 463.5),
    row(8, 460.5, 463.5),
    row(13, 460.3, 463.8),
    row(22, 459.5, 463.5),
  ];

  it('покупка: минимальный курс продажи, а не курс покупки обменника', () => {
    const offer = bestOffer(almaty, 'buying');
    expect(offer?.rate).toBe(463.5);
    // ровно та ошибка, из-за которой всё началось
    expect(offer?.rate).not.toBe(460.5);
  });

  it('продажа: максимальный курс покупки', () => {
    expect(bestOffer(almaty, 'selling')?.rate).toBe(460.5);
  });

  it('при равных курсах побеждает меньший depId — порядок устойчив', () => {
    // 463,5 сразу у 4, 8 и 22 — всегда должен выбираться один и тот же
    expect(bestOffer(almaty, 'buying')?.depId).toBe(4);
    expect(bestOffer([...almaty].reverse(), 'buying')?.depId).toBe(4);
  });

  it('фильтр по городу не пускает в подсказку отделение другого региона', () => {
    const mixed = [row(1, 470, 455, 'Астана'), row(2, 460, 464, 'Алматы')];
    const offer = bestOffer(mixed, 'buying', 'Алматы');
    expect(offer?.depId).toBe(2);
    expect(offer?.rate).toBe(464);
  });

  it('без фильтра города берётся вся сеть', () => {
    const mixed = [row(1, 470, 455, 'Астана'), row(2, 460, 464, 'Алматы')];
    expect(bestOffer(mixed, 'buying')?.depId).toBe(1);
  });

  it('отделения без этой валюты пропускаются, а не выигрывают нулём', () => {
    const withEmpty = [row(1, 0, 0), row(2, 460, 464)];
    expect(bestOffer(withEmpty, 'buying')?.depId).toBe(2);
    expect(bestOffer(withEmpty, 'selling')?.depId).toBe(2);
  });

  it('пустой список и город без отделений — предложения нет', () => {
    expect(bestOffer([], 'buying')).toBeNull();
    expect(bestOffer(almaty, 'buying', 'Шымкент')).toBeNull();
  });
});
