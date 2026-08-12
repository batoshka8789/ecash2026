import { config } from 'dotenv';

/**
 * Окружение для консольных инструментов (drizzle-kit, сид).
 *
 * Приложение читает `.env.local` — так устроен Next. А `dotenv/config`
 * подхватывает только `.env`, и при расхождении получалось молчаливое и
 * опасное поведение: разработчик кладёт боевой DATABASE_URL в `.env.local`,
 * запускает `npm run db:migrate`, а миграции уходят на localhost из
 * захардкоженного фоллбэка — команда рапортует об успехе, боевая база не
 * тронута.
 *
 * Порядок: `.env.local` важнее `.env` (как у Next), уже заданные переменные
 * окружения не перетираются — в CI и контейнере они главнее файлов.
 */
config({ path: '.env' });
config({ path: '.env.local', override: true });

/** URL базы для консольных инструментов. Без него — падаем явно, а не молча. */
export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL не задан. Укажите его в .env.local (или .env), либо ' +
        'передайте переменной окружения:\n' +
        '  DATABASE_URL=postgres://... npm run db:migrate\n\n' +
        'Раньше здесь стоял фоллбэк на localhost, и команда молча работала ' +
        'не с той базой. См. .env.example',
    );
  }
  return url;
}
