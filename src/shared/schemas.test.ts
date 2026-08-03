import { describe, expect, it } from 'vitest';
import {
  accountPatchBody,
  createRequestBody,
  loginBody,
  otpSendBody,
  phoneSchema,
  rateAlertBody,
  registerBody,
} from './schemas';

describe('phoneSchema', () => {
  it('чистит формат и принимает любые записи одного номера', () => {
    expect(phoneSchema.parse('+7 777 123-45-67')).toBe('+77771234567');
    expect(phoneSchema.parse('77771234567')).toBe('77771234567');
  });
  it('короткий номер отклоняется', () => {
    expect(phoneSchema.safeParse('12345').success).toBe(false);
  });
});

describe('loginBody', () => {
  it('телефон и ИИН проходят одинаково', () => {
    expect(loginBody.parse({ login: '+7 (705) 805 95 95', password: 'x' }).login).toBe(
      '+77058059595',
    );
    expect(loginBody.parse({ login: '990101300123', password: 'x' }).login).toBe('990101300123');
  });
});

describe('registerBody', () => {
  const valid = {
    phoneNumber: '77058059595',
    otp: '123456',
    password: 'password1',
    password2: 'password1',
  };
  it('валидная регистрация проходит', () => {
    expect(registerBody.safeParse(valid).success).toBe(true);
  });
  it('пароль без цифры отклоняется с кодом i18n', () => {
    const r = registerBody.safeParse({ ...valid, password: 'passwordx', password2: 'passwordx' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe('errors.passwordDigit');
  });
  it('несовпадающие пароли отклоняются', () => {
    const r = registerBody.safeParse({ ...valid, password2: 'password2' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe('errors.passwordMatch');
  });
});

describe('otpSendBody', () => {
  it('purpose только 0/1/2', () => {
    expect(otpSendBody.safeParse({ phoneNumber: '77058059595', purpose: 1 }).success).toBe(true);
    expect(otpSendBody.safeParse({ phoneNumber: '77058059595', purpose: 5 }).success).toBe(false);
  });
});

describe('createRequestBody', () => {
  const valid = {
    currencyFrom: 'KZT',
    currencyTo: 'USD',
    value: 962.11,
    rate: 519.7,
    amount: 500000,
    depId: 1,
  };
  it('валидная бронь проходит', () => {
    expect(createRequestBody.safeParse(valid).success).toBe(true);
  });
  it('совпадающие валюты отклоняются', () => {
    const r = createRequestBody.safeParse({ ...valid, currencyTo: 'KZT' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe('errors.CURRENCY_INVALID');
  });
  it('без отделения и кассы — DEPARTMENT_REQUIRED', () => {
    const rest = { ...valid };
    delete (rest as { depId?: number }).depId;
    const r = createRequestBody.safeParse(rest);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe('errors.DEPARTMENT_REQUIRED');
  });
  it('отрицательная сумма отклоняется', () => {
    expect(createRequestBody.safeParse({ ...valid, amount: -5 }).success).toBe(false);
  });
});

describe('rateAlertBody', () => {
  const future = new Date(Date.now() + 24 * 3600_000).toISOString();

  it('валидная подписка проходит', () => {
    const r = rateAlertBody.safeParse({
      currencyFrom: 'KZT',
      currencyTo: 'USD',
      targetRate: 500,
      until: future,
    });
    expect(r.success).toBe(true);
  });
  it('дата в прошлом отклоняется', () => {
    const r = rateAlertBody.safeParse({
      currencyFrom: 'KZT',
      currencyTo: 'USD',
      targetRate: 500,
      until: '2020-01-01T00:00:00Z',
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe('errors.dateInPast');
  });
  it('совпадающие валюты (KZT→KZT) отклоняются', () => {
    const r = rateAlertBody.safeParse({
      currencyFrom: 'KZT',
      currencyTo: 'KZT',
      targetRate: 500,
      until: future,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toBe('errors.CURRENCY_INVALID');
      expect(r.error.issues[0].path).toEqual(['currencyTo']);
    }
  });
});

describe('accountPatchBody — смена контактов', () => {
  const PHONE = '+7 777 123-45-67';

  it('смена телефона без кода из SMS не проходит', () => {
    // телефон = логин аккаунта: без подтверждения нового номера открытая
    // сессия могла бы увести аккаунт на чужой телефон
    const r = accountPatchBody.safeParse({ phoneNumber: PHONE });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(['otp']);
  });

  it('смена телефона с кодом проходит', () => {
    const r = accountPatchBody.safeParse({ phoneNumber: PHONE, otp: '123456' });
    expect(r.success).toBe(true);
    expect(r.data?.otp).toBe('123456');
  });

  it('код неверной длины отклоняется', () => {
    expect(accountPatchBody.safeParse({ phoneNumber: PHONE, otp: '12345' }).success).toBe(false);
    expect(accountPatchBody.safeParse({ phoneNumber: PHONE, otp: 'abcdef' }).success).toBe(false);
  });

  it('смена только почты кода не требует', () => {
    expect(accountPatchBody.safeParse({ email: 'a@b.kz' }).success).toBe(true);
  });

  it('пустой запрос отклоняется', () => {
    expect(accountPatchBody.safeParse({}).success).toBe(false);
  });
});
