import { sql } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { ecashStartupStatus } from '@/server/startup-check';

/**
 * Healthcheck для оркестратора: процесс жив + БД отвечает.
 *
 * `ok` намеренно НЕ зависит от Ecash: апстрим чужой, его сбой не должен
 * перезапускать наш контейнер по кругу — лендинг, новости и документы
 * продолжают работать. Состояние Ecash отдаётся отдельным полем, чтобы
 * после переезда на боевые ключи их исправность проверялась одним curl.
 */
/**
 * Короткий SHA развёрнутого коммита — Railway кладёт его в окружение сам.
 * Отвечает на вопрос «а доехал ли деплой?» одним curl: без этого правки
 * серверного кода снаружи неотличимы, и каждый деплой приходилось
 * подтверждать косвенными признаками. Нет переменной (локальный стенд,
 * другой хостинг) — поля просто нет.
 */
const build =
  process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ??
  process.env.SOURCE_COMMIT?.slice(0, 7);

export async function GET() {
  const ecash = ecashStartupStatus();
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, db: 'up', ecash, ...(build ? { build } : {}) });
  } catch {
    return Response.json({ ok: false, db: 'down', ecash, ...(build ? { build } : {}) }, { status: 503 });
  }
}
