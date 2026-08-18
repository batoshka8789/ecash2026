import { describe, expect, it } from 'vitest';
import { currencyFlagClass, formatPhoneInput } from './format';

describe('currencyFlagClass', () => {
  it('у каждой валюты живого контура есть свой флаг, а не золотая заглушка', () => {
    // Полный список кодов, которые реально отдаёт api-dev по всем
    // отделениям (замер 18.08.2026). Валюта без строки в карте флагов
    // рендерится золотым бейджем — так уже терялись 11 валют, потом ILS и
    // OMR; при появлении нового кода у Ecash этот тест укажет на пропуск.
    const live = [
      'AED', 'AMD', 'AUD', 'AZN', 'CAD', 'CHF', 'CNY', 'CZK', 'DZD', 'EUR',
      'GBP', 'GEL', 'IDR', 'ILS', 'INR', 'JPY', 'KGS', 'KRW', 'KZT', 'MXN',
      'OMR', 'PLN', 'QAR', 'RUB', 'SAR', 'SEK', 'SGD', 'THB', 'TJS', 'TRY',
      'UAH', 'USD', 'UZS', 'VND',
    ];
    const missing = live.filter((code) => currencyFlagClass(code) === null);
    expect(missing).toEqual([]);
  });

  it('золото и неизвестные коды — null (золотой бейдж)', () => {
    expect(currencyFlagClass('GOLD5')).toBeNull();
    expect(currencyFlagClass('XXX')).toBeNull();
  });
});

describe('formatPhoneInput', () => {
  it('набирает номер с нуля по цифре, не теряя первую', () => {
    // операторские коды KZ часто начинаются на 7 (705, 707, 708…) — код
    // страны нельзя срезать по первой цифре, иначе она пропадает здесь
    expect(formatPhoneInput('7')).toBe('+7 (7');
    expect(formatPhoneInput('70')).toBe('+7 (70');
    expect(formatPhoneInput('705')).toBe('+7 (705)');
    expect(formatPhoneInput('7051')).toBe('+7 (705) 1');
    expect(formatPhoneInput('7051234567')).toBe('+7 (705) 123 45 67');
  });

  it('посимвольный набор через контролируемый input: маска не съедает свой префикс', () => {
    // именно так значение живёт в React: каждое нажатие прогоняет УЖЕ
    // отформатированную строку через маску заново
    let value = '';
    const seen: string[] = [];
    for (const ch of '7051234567') {
      value = formatPhoneInput(value + ch);
      seen.push(value);
    }
    expect(seen).toEqual([
      '+7 (7',
      '+7 (70',
      '+7 (705)',
      '+7 (705) 1',
      '+7 (705) 12',
      '+7 (705) 123',
      '+7 (705) 123 4',
      '+7 (705) 123 45',
      '+7 (705) 123 45 6',
      '+7 (705) 123 45 67',
    ]);
  });

  it('срезает код страны только при ровно 11 цифрах', () => {
    expect(formatPhoneInput('77051234567')).toBe('+7 (705) 123 45 67');
    expect(formatPhoneInput('87051234567')).toBe('+7 (705) 123 45 67');
  });

  it('не трогает 10-значный номер, не начинающийся на 7/8', () => {
    expect(formatPhoneInput('9991234567')).toBe('+7 (999) 123 45 67');
  });

  it('чистит нецифровые символы и обрезает лишние цифры', () => {
    expect(formatPhoneInput('+7 (705) 123-45-67')).toBe('+7 (705) 123 45 67');
    expect(formatPhoneInput('705123456789')).toBe('+7 (705) 123 45 67');
  });

  it('пустая строка → пустая строка', () => {
    expect(formatPhoneInput('')).toBe('');
  });
});
