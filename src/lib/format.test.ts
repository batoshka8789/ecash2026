import { describe, expect, it } from 'vitest';
import { formatLoginInput, formatPhoneInput } from './format';

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

describe('formatLoginInput', () => {
  it('телефон подхватывает маску сразу', () => {
    expect(formatLoginInput('705')).toBe('+7 (705)');
    expect(formatLoginInput('7051234567')).toBe('+7 (705) 123 45 67');
  });

  it('номер с кодом страны тоже маскируется — раньше показывался сырыми цифрами', () => {
    // именно это видел заказчик: «77777777777» без маски, потому что маска
    // отключалась с 11 цифр ради 12-значного ИИН
    expect(formatLoginInput('77777777777')).toBe('+7 (777) 777 77 77');
    expect(formatLoginInput('87051234567')).toBe('+7 (705) 123 45 67');
  });

  it('вставка полного номера с «+» — телефонная маска', () => {
    expect(formatLoginInput('+77051234567')).toBe('+7 (705) 123 45 67');
  });

  it('почта не трогается маской', () => {
    expect(formatLoginInput('a')).toBe('a');
    expect(formatLoginInput('user@mail.kz')).toBe('user@mail.kz');
    // цифры в адресе тоже не должны превращаться в телефон
    expect(formatLoginInput('user777@mail.kz')).toBe('user777@mail.kz');
  });

  it('посимвольный ввод почты, начинающейся с цифр, не оставляет следов маски', () => {
    let value = '';
    for (const ch of '77mail@bk.ru') value = formatLoginInput(value + ch);
    expect(value).toBe('77mail@bk.ru');
  });
});
