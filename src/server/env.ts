import 'server-only';
import { z } from 'zod';

/**
 * Валидация серверного окружения. Падает при старте, если чего-то не хватает —
 * см. src/instrumentation.ts. В сообщении об ошибке только имена переменных,
 * никогда значения.
 */

const b64Bytes = (n: number) =>
  z.string().refine(
    (v) => {
      try {
        return Buffer.from(v, 'base64').length === n;
      } catch {
        return false;
      }
    },
    { message: `должно быть base64 ровно ${n} байт (openssl rand -base64 ${n})` },
  );

const schema = z.object({
  ECASH_API_BASE_URL: z.url(),
  ECASH_CLIENT_ID: z.string().min(1),
  ECASH_CLIENT_SECRET: z.string().min(1),
  ECASH_HUB_PATH: z.string().default('/appHub'),
  ECASH_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(8000),

  SESSION_SECRET: b64Bytes(32),
  SESSION_SECRET_PREVIOUS: b64Bytes(32).optional(),

  DATABASE_URL: z.string().min(1),

  APP_ORIGIN: z.url(),

  /**
   * Телефоны администраторов через запятую — единственный источник прав на
   * раздел публикации новостей. Ролей в API Ecash нет, своих пользователей мы
   * не заводим, поэтому признак админа задаётся окружением стенда.
   * Пусто (по умолчанию) = админов нет, раздел недоступен никому.
   */
  ADMIN_PHONES: z
    .string()
    .default('')
    .transform((s) =>
      s
        .split(',')
        .map((x) => x.replace(/\D/g, ''))
        .filter((x) => x.length >= 10),
    ),

  /**
   * Разрешить админку при ECASH_OTP_MOCK=1. По умолчанию НЕТ, и это важно:
   * в демо-режиме вход возможен под ЛЮБЫМ телефоном с общим паролем
   * (demoCheckPassword), поэтому знание номера админа = права админа.
   * Включать осознанно и только там, где это приемлемо.
   */
  ADMIN_IN_DEMO: z
    .enum(['0', '1'])
    .default('0')
    .transform((v) => v === '1'),

  /**
   * Почта для переводчика новостей. Работает и без неё, но анонимная дневная
   * норма — 5 000 символов на IP, а с указанной почтой 50 000. Это адрес
   * владельца стенда, наружу он не показывается.
   */
  TRANSLATE_EMAIL: z.email().optional(),

  /**
   * Ключи VAPID для браузерных push-уведомлений (web-push).
   * Пара генерируется один раз: `npx web-push generate-vapid-keys`.
   *
   * Публичный уходит в браузер (иначе подписаться нельзя) — это нормально,
   * он для того и публичный. Приватным сервер подписывает каждую отправку,
   * и он не должен покидать сервер, поэтому БЕЗ префикса NEXT_PUBLIC_:
   * публичный ключ отдаётся своим маршрутом /api/push/public-key.
   *
   * Обе переменные опциональны: без них push просто выключен — карточка
   * подписки не показывается, остальной сайт работает как прежде.
   * Менять пару после запуска нельзя: старые подписки браузеров привязаны
   * к прежнему публичному ключу и перестанут приниматься.
   */
  VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  /** Контакт для сервисов доставки (Google/Mozilla): mailto: или https://. */
  VAPID_SUBJECT: z.string().min(1).default('mailto:info@ecash.kz'),

  REALTIME_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  ECASH_OTP_MOCK: z
    .enum(['0', '1'])
    .default('0')
    .transform((v) => v === '1'),

  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

function load() {
  const r = schema.safeParse(process.env);
  if (!r.success) {
    const lines = r.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Некорректное серверное окружение:\n${lines}\n\nСм. .env.example`);
  }
  if (r.data.NODE_ENV === 'production') {
    // Двойной явный флаг — временная витрина/выставка, не обычный прод.
    // Один ECASH_OTP_MOCK=1 в проде по-прежнему падает: демо-режим не должен
    // включиться случайно на настоящем запуске.
    const allowDemo = process.env.ALLOW_DEMO_IN_PRODUCTION === '1';
    if (r.data.ECASH_OTP_MOCK && !allowDemo) {
      throw new Error(
        'ECASH_OTP_MOCK=1 запрещён в продакшене (для временного стенда ' +
          'дополнительно задайте ALLOW_DEMO_IN_PRODUCTION=1)',
      );
    }
    if (!r.data.APP_ORIGIN.startsWith('https:')) {
      throw new Error('APP_ORIGIN в продакшене должен быть https');
    }
  }
  return r.data;
}

export const env = load();
