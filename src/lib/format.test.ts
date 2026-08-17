import { describe, expect, it } from 'vitest';
import { formatPhoneInput } from './format';

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
