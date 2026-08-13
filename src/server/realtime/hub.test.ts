import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Хаб не должен ронять процесс и не должен долбить мёртвый апстрим.
 *
 * История: на дев-контуре Ecash апгрейд WebSocket не проходит — прокси
 * отвечает на него 200 вместо 101. SignalR при этом убивает транспорт прямо
 * во время рукопожатия, а его обработчик закрытия бросает мимо промисов:
 * в логе шли uncaughtException и unhandledRejection, и каждый
 * переподключающийся SSE-клиент заводил новую бесполезную попытку.
 *
 * Тесты держат два свойства: после двух неудач подряд хаб перестаёт
 * дёргаться на время остывания, а удачное подключение счётчик обнуляет.
 */

process.env.ECASH_API_BASE_URL = 'https://api-dev.quiq.kz';
process.env.ECASH_CLIENT_ID = 'test';
process.env.ECASH_CLIENT_SECRET = 'test';
process.env.SESSION_SECRET = Buffer.alloc(32, 7).toString('base64');
process.env.DATABASE_URL = 'postgres://t:t@localhost:5432/t';
process.env.APP_ORIGIN = 'http://localhost:3000';

const start = vi.fn();
const stop = vi.fn(() => Promise.resolve());

vi.mock('@microsoft/signalr', () => {
  class HubConnectionBuilder {
    withUrl() {
      return this;
    }
    withAutomaticReconnect() {
      return this;
    }
    configureLogging() {
      return this;
    }
    build() {
      return { on: vi.fn(), onclose: vi.fn(), start, stop };
    }
  }
  return {
    HubConnectionBuilder,
    HttpTransportType: { WebSockets: 1, ServerSentEvents: 2 },
    LogLevel: { Warning: 3 },
    HubConnection: class {},
  };
});

const { subscribeAccount } = await import('./hub');

type G = { __ecashHubs?: Map<string, unknown>; __ecashHubBreaker?: { failures: number; blockedUntil: number } };
const g = globalThis as unknown as G;

beforeEach(() => {
  vi.clearAllMocks();
  g.__ecashHubs?.clear();
  if (g.__ecashHubBreaker) {
    g.__ecashHubBreaker.failures = 0;
    g.__ecashHubBreaker.blockedUntil = 0;
  }
});

const subscribe = (id: string) => subscribeAccount(id, 'token', () => {});

describe('размыкатель хаба', () => {
  it('после двух неудач подряд третья попытка НЕ идёт в апстрим', async () => {
    start.mockRejectedValue(new Error('WebSocket failed to connect'));

    await expect(subscribe('a-1')).rejects.toThrow();
    await expect(subscribe('a-2')).rejects.toThrow();
    expect(start).toHaveBeenCalledTimes(2);

    await expect(subscribe('a-3')).rejects.toThrow('hub-unavailable');
    expect(start).toHaveBeenCalledTimes(2); // третьего вызова не было
  });

  it('неудачное соединение закрывается, чтобы не бросить позже', async () => {
    start.mockRejectedValue(new Error('handshake canceled'));
    await expect(subscribe('b-1')).rejects.toThrow();
    expect(stop).toHaveBeenCalled();
  });

  it('удачное подключение обнуляет счётчик неудач', async () => {
    start.mockRejectedValueOnce(new Error('fail'));
    await expect(subscribe('c-1')).rejects.toThrow();
    expect(g.__ecashHubBreaker?.failures).toBe(1);

    start.mockResolvedValueOnce(undefined);
    await subscribe('c-2');
    expect(g.__ecashHubBreaker?.failures).toBe(0);
  });

  it('обычный путь не задет: соединение поднимается и отдаёт отписку', async () => {
    start.mockResolvedValue(undefined);
    const unsubscribe = await subscribe('d-1');
    expect(start).toHaveBeenCalledTimes(1);
    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
  });

  it('на один аккаунт держим одно соединение, а не по одному на подписчика', async () => {
    start.mockResolvedValue(undefined);
    await subscribe('e-1');
    await subscribe('e-1');
    expect(start).toHaveBeenCalledTimes(1);
  });
});

describe('гашение бросков signalr мимо промисов', () => {
  const listeners = () => process.listeners('uncaughtException');

  it('обработчик поставлен ровно один раз на процесс', async () => {
    start.mockResolvedValue(undefined);
    const before = listeners().length;
    await subscribe('f-1');
    await subscribe('f-2');
    expect(listeners().length).toBe(before);
  });

  it('бросок signalr размыкает цепь', async () => {
    start.mockResolvedValue(undefined);
    await subscribe('g-1');
    const handler = listeners().at(-1)!;

    handler(
      new Error(
        'HttpConnection.stopConnection(Error: Server returned handshake error) was called while the connection is still in the connecting state.',
      ),
      'uncaughtException',
    );
    expect(g.__ecashHubBreaker?.failures).toBe(1);
  });

  it('чужие ошибки пропускает мимо и НИКОГДА не бросает сам', async () => {
    start.mockResolvedValue(undefined);
    await subscribe('h-1');
    const handler = listeners().at(-1)!;

    // бросок отсюда Node считает фатальным и убивает процесс — проверяем,
    // что обработчик молчит и не трогает счётчик чужой ошибкой
    expect(() => handler(new Error('обычная ошибка приложения'), 'uncaughtException')).not.toThrow();
    expect(g.__ecashHubBreaker?.failures).toBe(0);
  });
});
