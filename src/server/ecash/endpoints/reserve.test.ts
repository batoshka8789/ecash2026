import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Обход валидации amount в ядре (18.08.2026): ядро сверяет amount с
 * value × rate без ветвления по направлению (продолжение дефекта HANDOFF
 * 9.5). Семантически правильный amount = value / rate для KZT → валюта
 * отклоняется с 400 AMOUNT_MISMATCH — поэтому первым уходит то, что ядро
 * принимает, а на AMOUNT_MISMATCH (валидацию починили) — повтор по
 * контракту.
 */

vi.mock('server-only', () => ({}));
vi.mock('../http', () => ({ ecashFetch: vi.fn() }));

import { ecashFetch } from '../http';
import { EcashError } from '../errors';
import {
  contractAmount,
  createIndividualRate,
  createReserve,
  upstreamAmount,
} from './reserve';

const body = {
  currencyFrom: 'KZT',
  currencyTo: 'USD',
  value: 10_000,
  rate: 491,
  amount: 20.37, // оценка клиента — в апстрим не уходит
  depId: 10,
};

const rawOk = { requestId: 777, status: 0, currencyFrom: 'KZT', currencyTo: 'USD' };

beforeEach(() => {
  vi.mocked(ecashFetch).mockReset();
});

describe('формулы amount', () => {
  it('upstreamAmount — слепое умножение, как требует сегодняшнее ядро', () => {
    expect(upstreamAmount({ value: 10_000, rate: 491 })).toBe(4_910_000);
    expect(upstreamAmount({ value: 20, rate: 462.5 })).toBe(9_250);
  });

  it('contractAmount — сумма получения по контракту (раздел 4.3)', () => {
    expect(contractAmount({ value: 10_000, rate: 461, currencyFrom: 'KZT' })).toBe(21.69);
    expect(contractAmount({ value: 20, rate: 462.5, currencyFrom: 'USD' })).toBe(9_250);
  });
});

describe('createReserve', () => {
  it('в апстрим уходит value × rate строками value/rate, amount числом', async () => {
    vi.mocked(ecashFetch).mockResolvedValueOnce(rawOk);
    const r = await createReserve('tok', body);
    expect(r.requestId).toBe(777);

    expect(ecashFetch).toHaveBeenCalledTimes(1);
    const [path, opts] = vi.mocked(ecashFetch).mock.calls[0];
    expect(path).toBe('/mobile/reserve');
    expect(opts).toMatchObject({
      method: 'POST',
      token: 'tok',
      body: { value: '10000', rate: '491', amount: 4_910_000 },
    });
    // создание идёт через Camunda — таймаут длиннее справочного
    expect((opts as { timeoutMs?: number }).timeoutMs).toBeGreaterThan(20_000);
  });

  it('AMOUNT_MISMATCH на умножении → один повтор с amount по контракту', async () => {
    vi.mocked(ecashFetch)
      .mockRejectedValueOnce(new EcashError('AMOUNT_MISMATCH', 400, 'mismatch'))
      .mockResolvedValueOnce(rawOk);

    const r = await createReserve('tok', body);
    expect(r.requestId).toBe(777);

    expect(ecashFetch).toHaveBeenCalledTimes(2);
    const second = vi.mocked(ecashFetch).mock.calls[1][1] as { body: { amount: number } };
    expect(second.body.amount).toBe(20.37);
  });

  it('прочие ошибки ядра пробрасываются без повтора', async () => {
    vi.mocked(ecashFetch).mockRejectedValueOnce(
      new EcashError('CAMUNDA_START_FAILED', 500, 'camunda'),
    );
    await expect(createReserve('tok', body)).rejects.toMatchObject({
      code: 'CAMUNDA_START_FAILED',
    });
    expect(ecashFetch).toHaveBeenCalledTimes(1);
  });

  it('обе формулы совпали (валюта → KZT) — повтора нет даже на AMOUNT_MISMATCH', async () => {
    vi.mocked(ecashFetch).mockRejectedValueOnce(new EcashError('AMOUNT_MISMATCH', 400, 'mismatch'));
    await expect(
      createReserve('tok', { ...body, currencyFrom: 'USD', currencyTo: 'KZT', value: 20, rate: 462.5 }),
    ).rejects.toMatchObject({ code: 'AMOUNT_MISMATCH' });
    expect(ecashFetch).toHaveBeenCalledTimes(1);
  });
});

describe('createIndividualRate', () => {
  it('идёт тем же обходом на /mobile/reserve/individual-rate', async () => {
    vi.mocked(ecashFetch).mockResolvedValueOnce({ ...rawOk, isIndividual: true });
    const r = await createIndividualRate('tok', body);
    expect(r.isIndividual).toBe(true);
    expect(vi.mocked(ecashFetch).mock.calls[0][0]).toBe('/mobile/reserve/individual-rate');
  });
});
