import 'server-only';

/**
 * Короткий кеш пользовательских access-токенов В ПАМЯТИ процесса.
 *
 * Зачем: push о решении казначея должен уходить и когда человек уже закрыл
 * сайт, а заявки Ecash читаются только пользовательским токеном — сервисному
 * ядро отвечает 403 (проверено). Хранить refresh-токены в базе — значит
 * при её утечке отдать чужие сессии; к тому же Ecash ротирует refresh при
 * каждом обмене, и фоновое обновление гасило бы токен в куке человека —
 * тот внезапно оказывался бы разлогинен.
 *
 * Поэтому компромисс: access-токен, который и так проходит через сервер на
 * каждом авторизованном запросе, запоминается в памяти до своего истечения
 * (~15 минут у Ecash). Наблюдатель заявок пользуется им, пока он жив.
 * Диск и база не участвуют; перезапуск процесса просто очищает кеш.
 *
 * Честное следствие: окно доставки push ограничено сроком токена после
 * последнего действия человека. Бронь по регламенту держится до часа,
 * казначей обычно отвечает в первые минуты — практический случай покрыт.
 * Когда Ecash починят WebSocket, мгновенные события закроют остальное.
 */

type Entry = { token: string; expiresAt: number };

const g = globalThis as unknown as { __ecashUserTokens?: Map<string, Entry> };
const cache = (g.__ecashUserTokens ??= new Map());

/** Запас до истечения: не пользоваться токеном впритык к его концу. */
const MARGIN_MS = 60_000;

/** Срок из клейма exp самого JWT; нет клейма — считаем токен коротким. */
function jwtExpiryMs(token: string): number {
  const parts = token.split('.');
  if (parts.length !== 3) return Date.now() + 5 * 60_000;
  try {
    const pad = parts[1] + '='.repeat((4 - (parts[1].length % 4)) % 4);
    const payload = JSON.parse(
      Buffer.from(pad.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
    ) as { exp?: unknown };
    if (typeof payload.exp === 'number') return payload.exp * 1000;
  } catch {
    // не JWT или битый — короткий срок по умолчанию
  }
  return Date.now() + 5 * 60_000;
}

export function rememberUserToken(accountId: string, token: string): void {
  cache.set(accountId, { token, expiresAt: jwtExpiryMs(token) - MARGIN_MS });
  // попутная уборка, чтобы Map не росла бесконечно
  if (cache.size > 5_000) {
    const now = Date.now();
    for (const [k, v] of cache) if (v.expiresAt <= now) cache.delete(k);
  }
}

/** Живой токен аккаунта или null, если истёк/не видели. */
export function cachedUserToken(accountId: string): string | null {
  const e = cache.get(accountId);
  if (!e) return null;
  if (e.expiresAt <= Date.now()) {
    cache.delete(accountId);
    return null;
  }
  return e.token;
}

/** Токен отвергнут апстримом раньше срока — забыть, чтобы не долбить 401. */
export function forgetUserToken(accountId: string): void {
  cache.delete(accountId);
}
