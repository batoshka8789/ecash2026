import { describe, expect, it, vi } from 'vitest';

/** POST /api/requests: depId проверяется по реальному списку отделений. */

vi.mock('@/server/api/guard', () => ({
  withUser:
    (h: (req: Request, token: string, ctx: unknown) => Promise<Response>) =>
    (req: Request, ctx: unknown) =>
      h(req, 'demo-token', ctx ?? { params: Promise.resolve({}) }),
}));
vi.mock('@/server/session', () => ({
  readSession: async () => ({ accountId: 'acc-route-test' }),
}));
vi.mock('@/server/ecash/endpoints/departments', () => ({
  depList: vi.fn(async () => [{ depId: 5 }, { depId: 7 }]),
}));
vi.mock('@/server/demo/store', () => ({
  isDemoToken: () => true,
  demoCreate: vi.fn((_acc: string, body: Record<string, unknown>) => ({
    requestId: 10500,
    status: 0,
    ...body,
  })),
  demoList: vi.fn(),
}));
vi.mock('@/server/ecash/endpoints/reserve', () => ({
  createReserve: vi.fn(),
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
  it('несуществующий depId → 404 DEPARTMENT_NOT_FOUND', async () => {
    const res = await post({ ...valid, depId: 99999 });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({
      error: 'errors.DEPARTMENT_NOT_FOUND',
      field: 'depId',
    });
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
});
