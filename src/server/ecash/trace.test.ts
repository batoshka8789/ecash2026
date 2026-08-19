import { describe, expect, it } from 'vitest';
import { formatTrace, redact } from './trace';

/**
 * След показывают разработчикам Ecash, поэтому у него две обязанности:
 * буквально передать обмен и при этом не вынести наружу секреты и ПДн.
 */

describe('redact', () => {
  it('тело брони сохраняется дословно, ФИО скрыто', () => {
    expect(
      redact({
        currencyFrom: 'KZT',
        currencyTo: 'USD',
        value: '100000',
        rate: '462.5',
        amount: 46_250_000,
        depId: 1,
        fullName: 'Батыр Торахан',
      }),
    ).toEqual({
      currencyFrom: 'KZT',
      currencyTo: 'USD',
      value: '100000',
      rate: '462.5',
      amount: 46_250_000,
      depId: 1,
      fullName: '«ПДн»',
    });
  });

  it('пароли, коды и токены не попадают в лог', () => {
    const out = redact({
      login: '+77001234567',
      password: 'hunter22',
      otp: '123456',
      refreshToken: 'eyJhbGciOi...',
    }) as Record<string, string>;
    expect(out.password).toBe('«секрет»');
    expect(out.otp).toBe('«секрет»');
    expect(out.refreshToken).toBe('«секрет»');
    expect(JSON.stringify(out)).not.toContain('hunter22');
  });

  it('работает вглубь вложенных объектов и массивов', () => {
    const out = redact({ items: [{ iin: '900101300123', depId: 7 }] }) as {
      items: { iin: string; depId: number }[];
    };
    expect(out.items[0]).toEqual({ iin: '«ПДн»', depId: 7 });
  });

  it('примитивы и null проходят как есть', () => {
    expect(redact(null)).toBeNull();
    expect(redact(42)).toBe(42);
    expect(redact('текст')).toBe('текст');
  });
});

describe('formatTrace', () => {
  const base = {
    method: 'POST',
    url: 'https://api-dev.quiq.kz/mobile/reserve',
    body: { currencyFrom: 'KZT', currencyTo: 'USD', value: '100000', rate: '462.5', amount: 46_250_000, depId: 1 },
    withToken: true,
  };

  it('след ошибки: запрос, ответ и готовый curl — одним блоком', () => {
    const out = formatTrace({
      ...base,
      status: 500,
      ms: 138,
      responseText: '{"success":false,"code":500,"error":"CAMUNDA_START_FAILED"}',
      errCode: 'CAMUNDA_START_FAILED',
    });

    expect(out).toContain('POST https://api-dev.quiq.kz/mobile/reserve');
    expect(out).toContain('"amount":46250000');
    expect(out).toContain('ответ 500 CAMUNDA_START_FAILED за 138 мс');
    expect(out).toContain('CAMUNDA_START_FAILED');
    expect(out).toContain("curl -sS -i -X POST 'https://api-dev.quiq.kz/mobile/reserve'");
    // токен упоминается, но не печатается
    expect(out).toContain('Bearer <ТОКЕН>');
    // всё одним куском: параллельные запросы не перемешают строки
    expect(out.split('\n').every((l, i) => i === 0 || l.startsWith('  '))).toBe(true);
  });

  it('таймаут: ответа нет, но видно что ушло и сколько ждали', () => {
    const out = formatTrace({
      ...base,
      status: 0,
      ms: 25_000,
      responseText: '(ответа нет: таймаут или обрыв соединения)',
      errCode: 'UPSTREAM_TIMEOUT',
    });
    expect(out).toContain('ответ 0 UPSTREAM_TIMEOUT за 25000 мс');
    expect(out).toContain('ответа нет');
  });

  it('успешный ответ помечается OK и тоже показывает тело', () => {
    const out = formatTrace({
      ...base,
      status: 200,
      ms: 210,
      responseText: '{"requestId":6735,"status":8}',
    });
    expect(out).toContain('ответ 200 OK за 210 мс');
    expect(out).toContain('"requestId":6735');
  });

  it('длинный ответ обрезается, но говорит об этом', () => {
    const out = formatTrace({ ...base, status: 200, ms: 10, responseText: 'x'.repeat(5000) });
    expect(out).toContain('обрезано, всего 5000');
    expect(out.length).toBeLessThan(3000);
  });

  it('одинарные кавычки в теле не ломают команду curl', () => {
    const out = formatTrace({
      ...base,
      body: { comment: "O'Brien" },
      status: 400,
      ms: 5,
      responseText: '{}',
      errCode: 'VALIDATION',
    });
    expect(out).toContain(`'\\''`);
  });

  it('запрос без тела и без токена: ни content-type, ни -d в команде', () => {
    const out = formatTrace({
      method: 'GET',
      url: 'https://api-dev.quiq.kz/Department/depListApp',
      withToken: false,
      status: 200,
      ms: 33,
      responseText: '[]',
    });
    expect(out).toContain('отправлено: (без тела)');
    expect(out).not.toContain('-d ');
    expect(out).not.toContain('authorization');
  });
});
