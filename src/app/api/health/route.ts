import { sql } from 'drizzle-orm';
import { db } from '@/server/db/client';

/** Healthcheck для оркестратора: процесс жив + БД отвечает. */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, db: 'down' }, { status: 503 });
  }
}
