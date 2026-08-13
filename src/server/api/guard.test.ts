import { describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
import { EcashError } from '@/server/ecash/errors';

/**
 * Сбой обновления токена не должен ронять запрос пятисоткой.
 *
 * История бага: `userToken()` при истёкшем access-токене идёт в Ecash за
 * новым и НАМЕРЕННО бросает при сетевом сбое — чтобы не выкинуть человека
 * из аккаунта из-за чужой недоступности. Но ловить бросок было некому: он
 * улетал мимо обработчика, и Next отдавал голую 500 без тела. Снаружи это
 * выглядело как «сайт перестал работать» — переставал открываться весь
 * кабинет разом, без единого внятного сообщения.
 *
 * Тест держит контракт: любой сбой ядра превращается в нормальный ответ с
 * кодом ошибки, который интерфейс умеет показать.
 */

process.env.ECASH_API_BASE_URL = 'https://api-dev.quiq.kz';
process.env.ECASH_CLIENT_ID = 'test';
process.env.ECASH_CLIENT_SECRET = 'test';
process.env.SESSION_SECRET = Buffer.alloc(32, 7).toString('base64');
process.env.DATABASE_URL = 'postgres://t:t@localhost:5432/t';
process.env.APP_ORIGIN = 'http://localhost:3000';

const userToken = vi.fn();
const currentAccount = vi.fn();

vi.mock('@/server/session', () => ({ userToken: () => userToken() }));
vi.mock('@/server/account', () => ({ currentAccount: () => currentAccount() }));

const { withUser, withAdmin } = await import('./guard');

const call = (h: (req: Request, ...a: never[]) => Promise<Response>) =>
  h(new Request('http://localhost/api/requests'), {
    params: Promise.resolve({}),
  } as never);

const handler = async () => NextResponse.json({ reached: true });

describe('withUser при сбое обновления токена', () => {
  it('таймаут ядра → 504 с кодом, а не голая 500', async () => {
    userToken.mockRejectedValueOnce(new EcashError('UPSTREAM_TIMEOUT', 504, 'Upstream timeout'));
    const res = await call(withUser(handler));
    expect(res.status).toBe(504);
    expect(await res.json()).toMatchObject({ error: 'errors.UPSTREAM_TIMEOUT' });
  });

  it('ядро недоступно → тоже нормальный ответ', async () => {
    userToken.mockRejectedValueOnce(
      new EcashError('UPSTREAM_UNREACHABLE', 504, 'Upstream unreachable'),
    );
    const res = await call(withUser(handler));
    expect(res.status).toBe(504);
    expect(await res.json()).toMatchObject({ error: 'errors.UPSTREAM_UNREACHABLE' });
  });

  it('обработчик при сбое НЕ вызывается', async () => {
    userToken.mockRejectedValueOnce(new EcashError('UPSTREAM_TIMEOUT', 504, 'timeout'));
    const spy = vi.fn(handler);
    await call(withUser(spy));
    expect(spy).not.toHaveBeenCalled();
  });

  it('гость (токена нет) — по-прежнему 401', async () => {
    userToken.mockResolvedValueOnce(null);
    const res = await call(withUser(handler));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'errors.unauthorized' });
  });

  it('обычный путь не задет: с токеном обработчик вызывается', async () => {
    userToken.mockResolvedValueOnce('real-token');
    const res = await call(withUser(handler));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ reached: true });
  });
});

describe('withAdmin при сбое ядра', () => {
  it('сбой на этапе токена → 504, а не 500', async () => {
    userToken.mockRejectedValueOnce(new EcashError('UPSTREAM_TIMEOUT', 504, 'timeout'));
    const res = await call(withAdmin(handler));
    expect(res.status).toBe(504);
  });

  it('сбой на этапе аккаунта → тоже 504', async () => {
    userToken.mockResolvedValueOnce('real-token');
    currentAccount.mockRejectedValueOnce(
      new EcashError('UPSTREAM_UNAVAILABLE', 503, 'Upstream 503'),
    );
    const res = await call(withAdmin(handler));
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: 'errors.UPSTREAM_UNAVAILABLE' });
  });

  it('не-админ по-прежнему получает 404, а не подсказку о разделе', async () => {
    userToken.mockResolvedValueOnce('real-token');
    currentAccount.mockResolvedValueOnce({
      accountId: 'a-1',
      phoneNumber: '+7 700 000 00 01',
      isLinkedToClient: true,
      clientId: 1,
      iin: null,
      firstName: '',
      lastName: '',
      middleName: '',
    });
    const res = await call(withAdmin(handler));
    expect(res.status).toBe(404);
  });
});
