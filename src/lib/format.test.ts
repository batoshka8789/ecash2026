import { describe, expect, it } from 'vitest';
import { formatLoginInput, formatPhoneInput, prettifyLoginOnBlur } from './format';

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

describe('formatLoginInput — телефон или ИИН, без маски и без букв', () => {
  it('буквы не набираются вовсе — ловил заказчик: «343Зававыаыаыв» в поле логина', () => {
    expect(formatLoginInput('343Зававыаыаыв')).toBe('343');
    expect(formatLoginInput('abc')).toBe('');
    expect(formatLoginInput('user@mail.kz')).toBe('');
  });

  it('посимвольный ввод с буквами — остаются только цифры', () => {
    let value = '';
    for (const ch of '3азЗ4заЫ3') value = formatLoginInput(value + ch);
    expect(value).toBe('343');
  });

  it('ИИН набирается целиком — телефонная маска резала бы до 10 цифр', () => {
    let value = '';
    for (const ch of '990101300123') value = formatLoginInput(value + ch);
    expect(value).toBe('990101300123');
  });

  it('без «+» — не длиннее ИИН (12 цифр)', () => {
    expect(formatLoginInput('9901013001239999')).toBe('990101300123');
  });

  it('телефон с «+» проходит как есть, до 15 цифр (E.164)', () => {
    expect(formatLoginInput('+77051234567')).toBe('+77051234567');
    expect(formatLoginInput('+7 (705) 123 45 67')).toBe('+77051234567');
    expect(formatLoginInput('+7705123456789012345')).toBe('+770512345678901');
  });

  it('разделители вычищаются, цифры сохраняются', () => {
    expect(formatLoginInput('8 705 123-45-67')).toBe('87051234567');
  });
});

describe('prettifyLoginOnBlur — маска возвращается, когда набор закончен', () => {
  it('10 цифр и 11 с ведущей 7/8 — это телефон, надеваем маску', () => {
    expect(prettifyLoginOnBlur('7051234567')).toBe('+7 (705) 123 45 67');
    expect(prettifyLoginOnBlur('77051234567')).toBe('+7 (705) 123 45 67');
    expect(prettifyLoginOnBlur('87051234567')).toBe('+7 (705) 123 45 67');
  });

  it('ИИН не трогается — включая начинающийся на 7 или 8', () => {
    expect(prettifyLoginOnBlur('990101300123')).toBe('990101300123');
    expect(prettifyLoginOnBlur('850101300123')).toBe('850101300123');
  });

  it('незаконченный набор не трогается', () => {
    expect(prettifyLoginOnBlur('705123')).toBe('705123');
  });

  it('международный с «+» приводится к виду +7', () => {
    expect(prettifyLoginOnBlur('+77051234567')).toBe('+7 (705) 123 45 67');
  });
});
