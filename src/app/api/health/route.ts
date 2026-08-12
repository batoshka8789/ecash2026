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
export async function GET() {
  const ecash = ecashStartupStatus();
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, db: 'up', ecash });
  } catch {
    return Response.json({ ok: false, db: 'down', ecash }, { status: 503 });
  }
}
