import 'server-only';
import {
  HttpTransportType,
  HubConnection,
  HubConnectionBuilder,
  LogLevel,
} from '@microsoft/signalr';
import { env } from '@/server/env';
import type { RealtimeEvent } from '@/lib/domain';

/**
 * Серверный релей SignalR → SSE. Одно соединение с /appHub на аккаунт
 * (подключение с пользовательским токеном автоматически подписано на
 * account:{accountId}); события PushNotification раздаются всем открытым
 * SSE-потокам этого аккаунта. Счётчик ссылок закрывает соединение,
 * когда уходит последний подписчик.
 */

type Subscriber = (event: RealtimeEvent) => void;

type AccountHub = {
  connection: HubConnection;
  subscribers: Set<Subscriber>;
  /** отложенное закрытие, чтобы переживать перезагрузку страницы */
  closeTimer: ReturnType<typeof setTimeout> | null;
};

const g = globalThis as unknown as { __ecashHubs?: Map<string, AccountHub> };
const hubs = (g.__ecashHubs ??= new Map());

const CLOSE_GRACE_MS = 30_000;

function buildConnection(accessToken: string): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(`${env.ECASH_API_BASE_URL}${env.ECASH_HUB_PATH}`, {
      accessTokenFactory: () => accessToken,
      // серверный Node-клиент: WebSockets с фоллбэком на SSE
      transport: HttpTransportType.WebSockets | HttpTransportType.ServerSentEvents,
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(LogLevel.Warning)
    .build();
}

function parseEnvelope(raw: unknown): RealtimeEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as { type?: unknown; data?: unknown };
  if (typeof e.type !== 'string') return null;
  const data = (e.data && typeof e.data === 'object' ? e.data : {}) as Record<string, unknown>;
  return {
    ...(data as Partial<RealtimeEvent>),
    type: e.type as RealtimeEvent['type'],
    receivedAt: new Date().toISOString(),
  };
}

/**
 * Подписка на события аккаунта. Возвращает функцию отписки.
 * Бросает, если соединение с хабом не удалось установить.
 */
export async function subscribeAccount(
  accountId: string,
  accessToken: string,
  onEvent: Subscriber,
): Promise<() => void> {
  let hub = hubs.get(accountId);

  if (!hub) {
    const connection = buildConnection(accessToken);
    hub = { connection, subscribers: new Set(), closeTimer: null };
    hubs.set(accountId, hub);

    connection.on('PushNotification', (raw: unknown) => {
      const event = parseEnvelope(raw);
      if (!event) return;
      for (const fn of hub!.subscribers) {
        try {
          fn(event);
        } catch {
          // подписчик умер — его уберёт собственный cleanup
        }
      }
    });

    connection.onclose(() => {
      // авто-reconnect исчерпан — подписчики перейдут на поллинг сами
      hubs.delete(accountId);
    });

    try {
      await connection.start();
    } catch (e) {
      hubs.delete(accountId);
      throw e;
    }
  }

  if (hub.closeTimer) {
    clearTimeout(hub.closeTimer);
    hub.closeTimer = null;
  }
  hub.subscribers.add(onEvent);

  return () => {
    const h = hubs.get(accountId);
    if (!h) return;
    h.subscribers.delete(onEvent);
    if (h.subscribers.size === 0 && !h.closeTimer) {
      h.closeTimer = setTimeout(() => {
        if (h.subscribers.size === 0) {
          hubs.delete(accountId);
          void h.connection.stop();
        }
      }, CLOSE_GRACE_MS);
    }
  };
}
