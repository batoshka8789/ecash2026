import { describe, expect, it, vi } from 'vitest';
import { EcashError } from '@/server/ecash/errors';

/**
 * POST /api/requests/[id]/cancel: тело опционально, ошибки ядра корректно
 * транслируются в HTTP — 409 у терминальной заявки, 404 у несуществующей.
 */

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
      h(req, 'test-token', ctx),
}));
vi.mock('@/server/ecash/endpoints/reserve', () => ({
  cancelRequest: vi.fn(async (_token: string, id: number) => {
    if (id === 404404) throw new EcashError('REQUEST_NOT_FOUND', 404, 'нет такой заявки');
    if (id === 409409) throw new EcashError('REQUEST_NOT_CANCELLABLE', 409, 'terminal');
    return { requestId: id, status: 3, statusName: 'Отмена' };
  }),
}));

import { POST } from './route';

const post = (id: string, payload?: string) =>
  POST(new Request(`http://localhost/api/requests/${id}/cancel`, { method: 'POST', body: payload }), {
    params: Promise.resolve({ id }),
  });

describe('POST /api/requests/[id]/cancel', () => {
  it('без тела — успех, а не errors.badBody', async () => {
    const res = await post('10432');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.request.status).toBe(3);
  });

  it('с комментарием — успех', async () => {
    const res = await post('10432', JSON.stringify({ comment: 'передумал' }));
    expect(res.status).toBe(200);
  });

  it('битый JSON — 400 errors.badBody', async () => {
    const res = await post('10432', '{oops');
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'errors.badBody' });
  });

  it('уже терминальная заявка — 409 REQUEST_NOT_CANCELLABLE', async () => {
    const res = await post('409409');
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'errors.REQUEST_NOT_CANCELLABLE' });
  });

  it('неизвестная заявка — 404', async () => {
    const res = await post('404404');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: 'errors.REQUEST_NOT_FOUND' });
  });

  it('нечисловой id — 404 без обращения к ядру', async () => {
    const { cancelRequest } = await import('@/server/ecash/endpoints/reserve');
    vi.mocked(cancelRequest).mockClear();
    const res = await post('abc');
    expect(res.status).toBe(404);
    expect(cancelRequest).not.toHaveBeenCalled();
  });
});
