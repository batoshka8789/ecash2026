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

/** Состояние размыкателя: общее на процесс, а не на аккаунт. */
type Breaker = { failures: number; blockedUntil: number };

const g = globalThis as unknown as {
  __ecashHubs?: Map<string, AccountHub>;
  __ecashHubBreaker?: Breaker;
  __ecashHubGuard?: boolean;
};
const hubs = (g.__ecashHubs ??= new Map());
const breaker = (g.__ecashHubBreaker ??= { failures: 0, blockedUntil: 0 });

const CLOSE_GRACE_MS = 30_000;

/** После скольких подряд неудач перестаём дёргать хаб. */
const BREAKER_THRESHOLD = 2;
/** На сколько замолкаем. Клиенты это время живут на поллинге. */
const BREAKER_COOLDOWN_MS = 5 * 60_000;

/**
 * Гасим броски, которые signalr делает мимо промисов.
 *
 * В HttpConnection обработчик закрытия транспорта объявлен так:
 *
 *   this.transport.onclose = async (e) => { ... this._stopConnection(e) ... }
 *
 * а `_stopConnection` в состоянии Connecting бросает. Промис этой async-функции
 * никто не держит — в reconnect-ветке получается unhandledRejection, в обычной
 * бросок уходит прямо в цикл событий как uncaughtException. Поймать это своим
 * try/catch нельзя: наш `await connection.start()` к тому моменту уже вернулся.
 *
 * Воспроизводится, когда транспорт умирает во время рукопожатия — ровно наш
 * случай: апстрим отвечает на WebSocket-апгрейд кодом 200 вместо 101.
 *
 * Поэтому один раз на процесс вешаем СЛУШАТЕЛЯ, который узнаёт этот бросок по
 * тексту и размыкает цепь — превращает шум в сигнал «хаб мёртв, не ходи туда».
 *
 * Он именно слушатель, а не подавитель. Node вызывает всех подписчиков, так
 * что обработчик Next отработает следом и залогирует ошибку как раньше; чужие
 * ошибки мы просто пропускаем мимо. Бросать отсюда нельзя ни при каких
 * условиях: бросок внутри обработчика uncaughtException Node считает
 * фатальным и убивает процесс без шансов — то есть «защита» уронила бы сайт
 * вернее самой ошибки.
 */
function installSignalrGuard() {
  if (g.__ecashHubGuard) return;
  g.__ecashHubGuard = true;

  const noticed = (e: unknown) => {
    if (e instanceof Error && e.message.includes('was called while the connection is still in')) {
      openBreaker();
    }
  };

  process.on('uncaughtException', noticed);
  process.on('unhandledRejection', noticed);
}

function openBreaker() {
  breaker.failures += 1;
  if (breaker.failures >= BREAKER_THRESHOLD) {
    breaker.blockedUntil = Date.now() + BREAKER_COOLDOWN_MS;
    console.warn(
      `[hub] хаб недоступен ${breaker.failures} раз подряд — молчу ${BREAKER_COOLDOWN_MS / 60_000} мин, клиенты на поллинге`,
    );
  }
}

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
  installSignalrGuard();

  // Размыкатель. Без него каждый SSE-клиент, переподключаясь, поднимал новую
  // попытку связи с мёртвым хабом: в логе шёл поток ошибок, а человек всё
  // равно оставался на поллинге. Теперь после двух неудач подряд отвечаем
  // сразу — интерфейс уходит на поллинг без задержки на таймаут рукопожатия.
  if (Date.now() < breaker.blockedUntil) {
    throw new Error('hub-unavailable');
  }

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
      // связь есть — прошлые неудачи не в счёт
      breaker.failures = 0;
      breaker.blockedUntil = 0;
    } catch (e) {
      hubs.delete(accountId);
      // соединение могло остаться в промежуточном состоянии и позже бросить
      // мимо промисов — гасим его сами, ошибку закрытия игнорируем
      void connection.stop().catch(() => {});
      openBreaker();
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
          // stop() отклоняется, если соединение ещё не встало, — это не наша
          // забота, но без catch отклонение улетело бы в unhandledRejection
          void h.connection.stop().catch(() => {});
        }
      }, CLOSE_GRACE_MS);
    }
  };
}
