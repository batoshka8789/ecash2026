import { env } from '@/server/env';
import { readSession, userToken } from '@/server/session';
import { subscribeAccount } from '@/server/realtime/hub';

/**
 * SSE-поток событий заявки/курсов для браузера. Сервер держит SignalR
 * к Ecash и пересылает события; браузеру не нужны ни CORS Ecash,
 * ни доступ к токену. Heartbeat каждые 15 с держит прокси-соединения.
 */

export const dynamic = 'force-dynamic';

const HEARTBEAT_MS = 15_000;

export async function GET(req: Request) {
  // при сбое обновления токена поток не открываем, но и не падаем —
  // клиент останется на поллинге
  const token = await userToken().catch(() => null);
  const session = await readSession();
  if (!token || !session) {
    return new Response(null, { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: string, event?: string) => {
        try {
          controller.enqueue(
            encoder.encode(`${event ? `event: ${event}\n` : ''}data: ${data}\n\n`),
          );
        } catch {
          cleanup();
        }
      };

      let unsubscribe: (() => void) | null = null;
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      let closed = false;

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          // уже закрыт
        }
      };

      req.signal.addEventListener('abort', cleanup);

      heartbeat = setInterval(() => send('{}', 'ping'), HEARTBEAT_MS);
      send('{"ok":true}', 'ready');

      if (env.REALTIME_ENABLED) {
        try {
          unsubscribe = await subscribeAccount(session.accountId, token, (event) => {
            send(JSON.stringify(event));
          });
        } catch (e) {
          // хаб недоступен — клиент по событию 'degraded' переключится на поллинг
          console.warn('[events] SignalR недоступен, отдаю degraded', e);
          send('{"reason":"hub-unavailable"}', 'degraded');
        }
      } else {
        send('{"reason":"disabled"}', 'degraded');
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}
