import 'server-only';
import { env } from '@/server/env';
import { EcashError, networkError, normalizeError } from './errors';

/**
 * Типизированный fetch к api-dev.quiq.kz: таймаут, ретраи только для
 * идемпотентных GET, лог traceId и длительности — без токенов и ПДн.
 */

type FetchOpts = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Bearer-токен (сервисный или пользовательский). Без него запрос уходит анонимно. */
  token?: string;
  /** переопределение таймаута, мс */
  timeoutMs?: number;
  signal?: AbortSignal;
};

const RETRIABLE = new Set([502, 503, 504]);

export async function ecashFetch<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const { method = 'GET', body, token, timeoutMs = env.ECASH_TIMEOUT_MS, signal } = opts;
  const url = `${env.ECASH_API_BASE_URL}${path}`;
  const maxAttempts = method === 'GET' ? 3 : 1;

  let lastErr: EcashError | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const started = Date.now();
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: signal ?? AbortSignal.timeout(timeoutMs),
        cache: 'no-store',
      });
    } catch (cause) {
      lastErr = networkError(cause);
      if (attempt < maxAttempts) {
        await backoff(attempt);
        continue;
      }
      logCall(method, path, 0, Date.now() - started, lastErr.code);
      throw lastErr;
    }

    const ms = Date.now() - started;

    if (res.ok) {
      logCall(method, path, res.status, ms);
      // часть эндпоинтов отвечает literal true / пустым телом
      const text = await res.text();
      if (!text) return undefined as T;
      try {
        return JSON.parse(text) as T;
      } catch {
        return text as unknown as T;
      }
    }

    const errBody = await res.json().catch(() => null);
    const err = normalizeError(res.status, errBody);
    logCall(method, path, res.status, ms, err.code, err.traceId);

    if (RETRIABLE.has(res.status) && attempt < maxAttempts) {
      lastErr = err;
      await backoff(attempt);
      continue;
    }
    throw err;
  }
  /* istanbul ignore next -- цикл всегда завершается return/throw */
  throw lastErr ?? new EcashError('UNKNOWN', 500, 'unreachable');
}

function backoff(attempt: number) {
  const ms = Math.min(1000, 150 * 2 ** attempt) + Math.random() * 100;
  return new Promise((r) => setTimeout(r, ms));
}

function logCall(
  method: string,
  path: string,
  status: number,
  ms: number,
  errCode?: string,
  traceId?: string,
) {
  // путь без query — в query могут быть город/валюта, но не ПДн; телефоны ходят только в теле
  const clean = path.split('?')[0];
  const line = `[ecash] ${method} ${clean} ${status} ${ms}ms${errCode ? ` err=${errCode}` : ''}${traceId ? ` trace=${traceId}` : ''}`;
  if (errCode) console.warn(line);
  else if (process.env.NODE_ENV !== 'production') console.warn(line);
}
