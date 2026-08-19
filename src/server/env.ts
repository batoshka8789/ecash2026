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

  /**
   * Писать в лог полный JSON КАЖДОГО обмена с ядром Ecash (см. trace.ts).
   * Методы брони пишут его всегда и без этого флага — он нужен, когда
   * разбирается дефект в другом месте (профиль, OTP, справочники).
   * Секреты и ПДн маскируются в любом случае.
   */
  ECASH_TRACE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

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
   * depId отделений, которые не показываем посетителям (через запятую).
   *
   * Нужно для дев-контура Ecash: в нём рядом с настоящими отделениями лежат
   * служебные записи — «DEVTEST», «проверка лимитов», «Франшизы/Проверка».
   * Отличить их по данным нельзя: у них есть и адрес, и курсы, — а угадывать
   * по названию опасно, настоящее отделение может называться как угодно.
   * Поэтому список задаётся явно тем, кто разворачивает стенд.
   *
   * На боевом контуре служебных записей нет — переменная остаётся пустой.
   */
  HIDDEN_DEP_IDS: z
    .string()
    .default('')
    .transform((s) =>
      s
        .split(',')
        .map((x) => Number(x.trim()))
        .filter((n) => Number.isInteger(n) && n > 0),
    ),


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

  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

function load() {
  const r = schema.safeParse(process.env);
  if (!r.success) {
    const lines = r.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Некорректное серверное окружение:\n${lines}\n\nСм. .env.example`);
  }
  if (r.data.NODE_ENV === 'production') {
    if (!r.data.APP_ORIGIN.startsWith('https:')) {
      throw new Error('APP_ORIGIN в продакшене должен быть https');
    }
  }
  return r.data;
}

export const env = load();
