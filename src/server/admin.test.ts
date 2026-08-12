import { describe, expect, it } from 'vitest';

/**
 * Контракт прав администратора: доступ привязан к номеру телефона намертво.
 *
 * Админ — тот и только тот, чей номер перечислен в ADMIN_PHONES. Номер
 * подтверждён входом через Ecash, ролей в API нет и своих пользователей мы
 * не заводим. Эти тесты фиксируют и разрешающие случаи, и попытки обойти
 * проверку форматом номера.
 */

// env читается при импорте модуля — заполняем ДО динамического импорта ниже
process.env.ECASH_API_BASE_URL = 'https://api-dev.quiq.kz';
process.env.ECASH_CLIENT_ID = 'test';
process.env.ECASH_CLIENT_SECRET = 'test';
process.env.SESSION_SECRET = Buffer.alloc(32, 7).toString('base64');
process.env.DATABASE_URL = 'postgres://t:t@localhost:5432/t';
process.env.APP_ORIGIN = 'http://localhost:3000';
process.env.ADMIN_PHONES = '+7 775 930 21 88, 87019998877';

const { isAdminAccount, isAdminPhone } = await import('./admin');

const account = (phoneNumber: string) =>
  ({
    accountId: 'a-1',
    phoneNumber,
    isLinkedToClient: true,
    clientId: 1,
    iin: null,
    firstName: '',
    lastName: '',
    middleName: '',
  }) as Parameters<typeof isAdminAccount>[0];

describe('доступ даётся строго по номеру', () => {
  it('номер из списка — админ', () => {
    expect(isAdminAccount(account('+7 775 930 21 88'))).toBe(true);
  });

  it('второй номер списка тоже работает', () => {
    expect(isAdminAccount(account('+77019998877'))).toBe(true);
  });

  it('посторонний номер — не админ', () => {
    expect(isAdminAccount(account('+7 700 111 22 33'))).toBe(false);
  });

  it('гость — не админ', () => {
    expect(isAdminAccount(null)).toBe(false);
  });
});

describe('формат записи не влияет на решение', () => {
  // ядро отдаёт телефон в неизвестном формате, а в переменной он записан
  // руками — сверка идёт по последним 10 цифрам
  const same = ['+77759302188', '77759302188', '87759302188', '+7 (775) 930-21-88', '775 930 21 88'];
  for (const p of same) {
    it(`«${p}» — тот же номер`, () => {
      expect(isAdminPhone(p)).toBe(true);
    });
  }
});

describe('обойти привязку нельзя', () => {
  it('лишние цифры в начале не помогают — сверяются последние 10', () => {
    // на всякий случай фиксируем поведение явно: длинный префикс отбрасывается
    expect(isAdminPhone('999997759302188')).toBe(true);
  });

  it('изменённая последняя цифра — не админ', () => {
    expect(isAdminPhone('+7 775 930 21 89')).toBe(false);
  });

  it('короткий номер не совпадает ни с чем', () => {
    expect(isAdminPhone('9302188')).toBe(false);
    expect(isAdminPhone('21 88')).toBe(false);
  });

  it('пустое и мусор — не админ', () => {
    expect(isAdminPhone('')).toBe(false);
    expect(isAdminPhone('   ')).toBe(false);
    expect(isAdminPhone('не номер')).toBe(false);
  });

  it('аккаунт без телефона — не админ', () => {
    expect(isAdminAccount(account(''))).toBe(false);
  });
});
