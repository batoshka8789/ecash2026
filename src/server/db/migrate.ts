import 'server-only';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './client';

/**
 * Накат миграций при старте сервера.
 *
 * Раньше их не запускал никто: в контейнере стоит `CMD ["node","server.js"]`,
 * а `drizzle-kit migrate` живёт в devDependencies и в рантайм-образ не
 * попадает. Схема в репозитории уходила вперёд, прод-база оставалась на той
 * версии, до которой её однажды довели руками, и запись в новую колонку
 * молча падала — так «переставал сохраняться» профиль.
 *
 * Здесь используется программный мигратор drizzle-orm (он в обычных
 * зависимостях), поэтому папку `drizzle/` достаточно положить в образ.
 */
export async function runMigrations(): Promise<void> {
  const folder = path.join(process.cwd(), 'drizzle');

  // В образ папка копируется отдельным шагом Dockerfile; если её нет —
  // молча пропускаем, чтобы не ронять локальные сценарии без миграций.
  if (!existsSync(folder)) {
    console.warn('[migrate] папка drizzle/ не найдена — миграции пропущены');
    return;
  }

  try {
    await migrate(db, { migrationsFolder: folder });
  } catch (e) {
    // Падение миграции не должно гасить весь стенд: сайт с частично
    // устаревшей базой лучше недоступного, а причина видна в логах.
    console.error('[migrate] не удалось применить миграции:', e);
  }
}
