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
  ECASH_SERVICE_SCOPE: z.string().default('mobile-service'),
  ECASH_HUB_PATH: z.string().default('/appHub'),
  ECASH_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(8000),

  SESSION_SECRET: b64Bytes(32),
  SESSION_SECRET_PREVIOUS: b64Bytes(32).optional(),

  DATABASE_URL: z.string().min(1),

  APP_ORIGIN: z.url(),

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
    if (r.data.ECASH_OTP_MOCK) {
      throw new Error('ECASH_OTP_MOCK=1 запрещён в продакшене');
    }
    if (!r.data.APP_ORIGIN.startsWith('https:')) {
      throw new Error('APP_ORIGIN в продакшене должен быть https');
    }
  }
  return r.data;
}

export const env = load();
