import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Конвертация сумм на границе с ядром (замер 19.08.2026): у ядра value —
 * сумма в ИНОСТРАННОЙ валюте, amount — сумма в ТЕНГЕ при любом направлении
 * пары (текст его ошибки AMOUNT_MISMATCH), всегда amount = value × rate.
 * Наша модель — value: что клиент отдаёт, amount: что получает. Прежний
 * код слал тенге в поле валюты, и ядро читало «100 000 долларов».
 */

vi.mock('server-only', () => ({}));
vi.mock('../http', () => ({ ecashFetch: vi.fn() }));

import { ecashFetch } from '../http';
import { createIndividualRate, createReserve } from './reserve';

const rawOk = { requestId: 777, status: 0, currencyFrom: 'KZT', currencyTo: 'USD' };

beforeEach(() => {
  vi.mocked(ecashFetch).mockReset();
});

describe('createReserve — конвертация в семантику ядра', () => {
  it('отдаю тенге: value уходит в валюте (÷), amount — в тенге', async () => {
    vi.mocked(ecashFetch).mockResolvedValueOnce(rawOk);
    // клиент: отдаю 100 000 ₸ по 462.5, получу 216.22 $
    const r = await createReserve('tok', {
      currencyFrom: 'KZT',
      currencyTo: 'USD',
      value: 100_000,
      rate: 462.5,
      amount: 216.22,
      depId: 1,
    });
    expect(r.requestId).toBe(777);

    expect(ecashFetch).toHaveBeenCalledTimes(1);
    const [path, opts] = vi.mocked(ecashFetch).mock.calls[0];
    expect(path).toBe('/mobile/reserve');
    expect(opts).toMatchObject({
      method: 'POST',
      token: 'tok',
      // 100000 / 462.5 = 216.216… → 216.22 в валюте; тенге — как ввёл клиент
      body: { value: '216.22', rate: '462.5', amount: 100_000 },
    });
    // создание идёт через Camunda — таймаут длиннее справочного
    expect((opts as { timeoutMs?: number }).timeoutMs).toBeGreaterThan(20_000);
  });

  it('отдаю валюту: value уходит как есть, amount — произведение в тенге', async () => {
    vi.mocked(ecashFetch).mockResolvedValueOnce({ ...rawOk, currencyFrom: 'USD', currencyTo: 'KZT' });
    await createReserve('tok', {
      currencyFrom: 'USD',
      currencyTo: 'KZT',
      value: 20,
      rate: 462.5,
      amount: 9_250,
      depId: 1,
    });
    const body = (vi.mocked(ecashFetch).mock.calls[0][1] as { body: Record<string, unknown> }).body;
    expect(body).toMatchObject({ value: '20', rate: '462.5', amount: 9_250 });
  });

  it('amount клиента не пересылается — суммы выводятся из value и rate', async () => {
    vi.mocked(ecashFetch).mockResolvedValueOnce(rawOk);
    // клиент прислал заведомо кривой amount — в ядро всё равно уходит расчётный
    await createReserve('tok', {
      currencyFrom: 'KZT',
      currencyTo: 'USD',
      value: 100_000,
      rate: 491,
      amount: 999_999,
      depId: 1,
    });
    const body = (vi.mocked(ecashFetch).mock.calls[0][1] as { body: Record<string, unknown> }).body;
    // 100000 / 491 = 203.666… → 203.67
    expect(body).toMatchObject({ value: '203.67', amount: 100_000 });
  });
});

describe('createIndividualRate', () => {
  it('идёт той же конвертацией на /mobile/reserve/individual-rate', async () => {
    vi.mocked(ecashFetch).mockResolvedValueOnce({ ...rawOk, isIndividual: true });
    const r = await createIndividualRate('tok', {
      currencyFrom: 'KZT',
      currencyTo: 'EUR',
      value: 500_000,
      rate: 540,
      amount: 925.93,
      depId: 1,
    });
    expect(r.isIndividual).toBe(true);
    const [path, opts] = vi.mocked(ecashFetch).mock.calls[0];
    expect(path).toBe('/mobile/reserve/individual-rate');
    expect((opts as { body: Record<string, unknown> }).body).toMatchObject({
      value: '925.93',
      amount: 500_000,
    });
  });
});
