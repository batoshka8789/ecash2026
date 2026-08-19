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
  it('отдаю тенге: целые единицы валюты (floor) и тенге ровно по их цене', async () => {
    vi.mocked(ecashFetch).mockResolvedValueOnce(rawOk);
    // клиент: отдаю 100 000 ₸ по 462.5 → сделка «216 $ за 99 900 ₸»
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
      // floor(100000 / 462.5) = 216 целых долларов; 216 × 462.5 = 99 900 ₸ —
      // пара сходится с тождеством ядра amount = value × rate
      body: { value: '216', rate: '462.5', amount: 99_900 },
    });
    // создание идёт через Camunda — таймаут длиннее справочного
    expect((opts as { timeoutMs?: number }).timeoutMs).toBeGreaterThan(20_000);
  });

  it('отдаю валюту: купюры как ввёл клиент, тенге — целыми', async () => {
    vi.mocked(ecashFetch).mockResolvedValueOnce({ ...rawOk, currencyFrom: 'USD', currencyTo: 'KZT' });
    await createReserve('tok', {
      currencyFrom: 'USD',
      currencyTo: 'KZT',
      value: 20,
      rate: 466.71,
      amount: 9_334.2,
      depId: 1,
    });
    const body = (vi.mocked(ecashFetch).mock.calls[0][1] as { body: Record<string, unknown> }).body;
    // 20 × 466.71 = 9334.2 → 9334 целых тенге
    expect(body).toMatchObject({ value: '20', rate: '466.71', amount: 9_334 });
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
    // floor(100000 / 491) = 203; 203 × 491 = 99 673 ₸
    expect(body).toMatchObject({ value: '203', amount: 99_673 });
  });

  it('двоичная пыль не съедает целую единицу на floor', async () => {
    vi.mocked(ecashFetch).mockResolvedValueOnce(rawOk);
    // 64.8 / 0.72 в плавающей точке — 89.99999…, а математически ровно 90
    await createReserve('tok', {
      currencyFrom: 'KZT',
      currencyTo: 'USD',
      value: 64.8,
      rate: 0.72,
      amount: 90,
      depId: 1,
    });
    const body = (vi.mocked(ecashFetch).mock.calls[0][1] as { body: Record<string, unknown> }).body;
    expect(body).toMatchObject({ value: '90', amount: 65 });
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
    // floor(500000 / 540) = 925 целых евро; 925 × 540 = 499 500 ₸
    expect((opts as { body: Record<string, unknown> }).body).toMatchObject({
      value: '925',
      amount: 499_500,
    });
  });
});
