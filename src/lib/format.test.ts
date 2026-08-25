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

  /**
   * Backspace на символе оформления (скобка, пробел) в браузере физически
   * удаляет ровно этот символ из DOM-значения — маска же собирается заново
   * из тех же цифр и тут же ставит его обратно. Человеку приходилось сперва
   * жать стрелку влево, чтобы курсор оказался перед цифрой. `prev` —
   * предыдущее значение того же контролируемого поля — позволяет отличить
   * такое удаление (цифр стало не меньше при более короткой строке) от
   * обычного набора и довершить его самостоятельно.
   */
  describe('backspace на оформлении — второй аргумент prev', () => {
    it('репорт бага: Backspace сразу после закрывающей скобки — «+7 (705)» → «+7 (70»', () => {
      const before = formatPhoneInput('705'); // "+7 (705)"
      const raw = before.slice(0, -1); // браузер уже стёр ")" — "+7 (705"
      expect(formatPhoneInput(raw, before)).toBe('+7 (70');
    });

    it('без prev поведение старое: скобка встаёт обратно (регресс, если prev не передать)', () => {
      const before = formatPhoneInput('705');
      const raw = before.slice(0, -1);
      expect(formatPhoneInput(raw)).toBe(before);
    });

    it('обычный Backspace по цифре — как раньше, без двойного удаления', () => {
      const before = formatPhoneInput('7051234567'); // "+7 (705) 123 45 67"
      const raw = before.slice(0, -1); // стёрли цифру "7" в конце
      expect(formatPhoneInput(raw, before)).toBe('+7 (705) 123 45 6');
    });

    it('полный обратный набор от 10 цифр до пустой строки — без застреваний', () => {
      let value = formatPhoneInput('7051234567');
      const seen: string[] = [value];
      for (let i = 0; i < 30 && value; i++) {
        const raw = value.slice(0, -1);
        const next = formatPhoneInput(raw, value);
        // застревание — это когда Backspace НИЧЕГО не поменял
        expect(next).not.toBe(value);
        value = next;
        seen.push(value);
      }
      expect(value).toBe('');
      expect(seen).toContain('+7 (705) 123 45 6');
      expect(seen).toContain('+7 (70');
    });

    it('вставка/набор — не приводит к лишнему удалению цифры', () => {
      // символы длиннее prev — это не удаление, компенсация не должна сработать
      const before = formatPhoneInput('70'); // "+7 (70"
      expect(formatPhoneInput(before + '5', before)).toBe('+7 (705)');
    });

    it('typo нецифрой не путается с удалением (число цифр не меняется, но строка длиннее)', () => {
      const before = formatPhoneInput('70'); // "+7 (70"
      // пользователь вставил букву — длина выросла, цифр не прибавилось
      expect(formatPhoneInput(before + 'x', before)).toBe(before);
    });
  });
});
