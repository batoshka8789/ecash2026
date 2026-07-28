import 'server-only';
import type { AuthTokens } from './endpoints/auth';

/**
 * Печать выданной апстримом пары токенов в консоль СЕРВЕРА (терминал, где
 * поднят `npm run dev`, и `.next/dev/logs/next-development.log`).
 *
 * Зачем отдельная функция, а не console.log по месту:
 *
 * 1. Токены НЕ доходят до браузера by design. `/mobile/auth/register` и
 *    `/mobile/auth/login` отдают accessToken/refreshToken нашему серверу,
 *    он кладёт их в зашифрованную httpOnly-куку (src/server/session.ts) и
 *    возвращает клиенту только объект account. Клиентский JS bearer никогда
 *    не видит — поэтому в консоли devtools его и нет.
 * 2. Печать намертво заперта в dev: в проде токен в логах — это готовый
 *    ключ от аккаунта для всякого, у кого есть доступ к логам.
 *
 * Выключить, не трогая код: ECASH_LOG_TOKENS=0.
 */
export function logAuthTokens(scope: string, tokens: AuthTokens): void {
  if (process.env.NODE_ENV === 'production') return;
  if (process.env.ECASH_LOG_TOKENS === '0') return;

  // console.warn, а не log: проектный eslint пропускает в консоль только
  // warn/error, и это здесь кстати — строка должна бросаться в глаза.
  console.warn(
    `\n[ecash:${scope}] токены апстрима\n` +
      `  tokenType:    ${tokens.tokenType}\n` +
      `  expiresIn:    ${tokens.expiresIn} c\n` +
      `  Authorization: Bearer ${tokens.accessToken}\n` +
      `  refreshToken: ${tokens.refreshToken}\n`,
  );
}

/**
 * То же место в потоке, но для демо-режима (ECASH_OTP_MOCK=1): апстрим не
 * вызывается вовсе, настоящего bearer не существует. Пишем об этом прямо,
 * иначе в логе оказывается заглушка `demo-token`, которую легко принять
 * за сломанный ответ сервера.
 */
export function logDemoTokens(scope: string, demoToken: string): void {
  if (process.env.NODE_ENV === 'production') return;
  if (process.env.ECASH_LOG_TOKENS === '0') return;

  // console.warn, а не log: проектный eslint пропускает в консоль только
  // warn/error, и это здесь кстати — строка должна бросаться в глаза.
  console.warn(
    `\n[ecash:${scope}] демо-режим (ECASH_OTP_MOCK=1): запроса к апстриму не было,\n` +
      `  настоящего bearer нет — в сессию положен заглушечный «${demoToken}».\n` +
      `  Чтобы увидеть реальный токен, снимите ECASH_OTP_MOCK и заполните\n` +
      `  ECASH_CLIENT_SECRET в .env.local.\n`,
  );
}
