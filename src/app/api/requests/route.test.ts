import { describe, expect, it, vi } from 'vitest';

/** POST /api/requests: depId проверяется по реальному списку отделений. */

vi.mock('@/server/request-watch', () => ({
  // наблюдение — побочный эффект; тесты роутов проверяют контракт ответа
  syncWatch: vi.fn(),
  syncWatchMany: vi.fn(),
}));
vi.mock('@/server/session', () => ({
  readSession: vi.fn(async () => ({ accountId: 'a-1' })),
}));
vi.mock('@/server/api/guard', () => ({
  withUser:
    (h: (req: Request, token: string, ctx: unknown) => Promise<Response>) =>
    (req: Request, ctx: unknown) =>
      h(req, 'test-token', ctx ?? { params: Promise.resolve({}) }),
}));
vi.mock('@/server/ecash/endpoints/departments', () => ({
  depList: vi.fn(async () => [{ depId: 5 }, { depId: 7 }]),
}));
vi.mock('@/server/ecash/endpoints/reserve', () => ({
  createReserve: vi.fn(async (_token: string, body: Record<string, unknown>) => ({
    requestId: 10500,
    status: 0,
    ...body,
  })),
  listOperations: vi.fn(),
}));

import { POST } from './route';

const valid = {
  currencyFrom: 'USD',
  currencyTo: 'KZT',
  value: 100,
  rate: 519.7,
  amount: 51970,
};

const post = (payload: unknown) =>
  POST(
    new Request('http://localhost/api/requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
    { params: Promise.resolve({}) },
  );

describe('POST /api/requests', () => {
  it('несуществующий depId → 404 DEPARTMENT_NOT_FOUND без обращения к ядру', async () => {
    const { createReserve } = await import('@/server/ecash/endpoints/reserve');
    vi.mocked(createReserve).mockClear();
    const res = await post({ ...valid, depId: 99999 });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({
      error: 'errors.DEPARTMENT_NOT_FOUND',
      field: 'depId',
    });
    expect(createReserve).not.toHaveBeenCalled();
  });

  it('существующий depId → 201', async () => {
    const res = await post({ ...valid, depId: 5 });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.request.depId).toBe(5);
  });

  it('заявка только с kassaId создаётся без проверки depId', async () => {
    const { depList } = await import('@/server/ecash/endpoints/departments');
    vi.mocked(depList).mockClear();
    const res = await post({ ...valid, kassaId: 3 });
    expect(res.status).toBe(201);
    expect(depList).not.toHaveBeenCalled();
  });

  it('тенге меньше цены одной единицы валюты → 400 без обращения к ядру', async () => {
    const { createReserve } = await import('@/server/ecash/endpoints/reserve');
    vi.mocked(createReserve).mockClear();
    // сделка идёт целыми единицами: 100 ₸ при курсе 462.5 — это 0 долларов;
    // тот же код, которым отвечает ядро (VALUE_TOO_SMALL, раздел 4.1)
    const res = await post({
      currencyFrom: 'KZT',
      currencyTo: 'USD',
      value: 100,
      rate: 462.5,
      amount: 0.22,
      kassaId: 3,
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: 'errors.VALUE_TOO_SMALL',
      field: 'value',
    });
    expect(createReserve).not.toHaveBeenCalled();
  });
});
