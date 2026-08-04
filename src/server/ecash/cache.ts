import 'server-only';

/**
 * TTL-кеш апстрим-справочников (курсы, отделения) с коалесингом.
 *
 * Без него каждый посетитель бил в api-dev.quiq.kz напрямую: одна страница
 * отделений — это 1 depList + 18 depInfo, то есть тысяча пользователей
 * превращалась в ~20 000 апстрим-запросов и таймауты на весь сайт. Данные
 * при этом общие для всех и меняются редко (курсы — раз в минуты).
 *
 * Три свойства:
 *  — TTL: в окне свежести все посетители получают один и тот же ответ
 *    из памяти, апстрим видит не «по запросу на пользователя», а
 *    «по запросу на окно»;
 *  — коалесинг: одновременные промахи по одному ключу ждут ОДИН общий
 *    запрос, а не устраивают стадо (thundering herd) после истечения TTL;
 *  — stale-on-error: если апстрим упал, а протухшее значение есть —
 *    отдаём его, как уже делает market-rate.ts для фида НБ РК: чуть
 *    устаревший курс полезнее ошибки на весь сайт.
 *
 * Кеш в памяти процесса — корректно для одного инстанса (наш хостинг),
 * как и rate-limiter в guard.ts; при горизонтальном масштабировании
 * заменить на Redis. Ключей конечное число (отделения × валюты) — рост
 * Map ограничен по построению.
 */

type Entry = { value: unknown; expiresAt: number };
type CacheState = { entries: Map<string, Entry>; inflight: Map<string, Promise<unknown>> };

const g = globalThis as unknown as { __ecashUpstreamCache?: CacheState };
const cache: CacheState = (g.__ecashUpstreamCache ??= {
  entries: new Map(),
  inflight: new Map(),
});

export async function cachedUpstream<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const hit = cache.entries.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;

  const running = cache.inflight.get(key);
  if (running) return running as Promise<T>;

  const p = fn()
    .then((value) => {
      cache.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .catch((err) => {
      if (hit) return hit.value as T;
      throw err;
    })
    .finally(() => {
      cache.inflight.delete(key);
    });
  cache.inflight.set(key, p);
  return p as Promise<T>;
}

/** Только для тестов: полный сброс состояния кеша. */
export function resetUpstreamCache(): void {
  cache.entries.clear();
  cache.inflight.clear();
}
