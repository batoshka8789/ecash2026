import { desc, eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { news } from '@/server/db/schema';
import { fromError, ok, zodFail } from '@/server/api/respond';
import { toPublicPost } from '@/server/db/news';
import { publicNewsQuery } from '@/shared/schemas';

/**
 * Публичная лента. Отдаём один уже выбранный язык, а не все четыре: клиент
 * всё равно не может использовать остальные, а правило фолбэка на русский
 * остаётся в одном месте на сервере.
 *
 * Черновики не отдаются вовсе. Тело статьи в ленте не передаётся — оно
 * приходит на странице новости.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = publicNewsQuery.safeParse(Object.fromEntries(url.searchParams));
  if (!q.success) return zodFail(q.error);

  try {
    const rows = await db
      .select()
      .from(news)
      .where(eq(news.status, 'published'))
      .orderBy(desc(news.publishedAt));

    return ok({
      posts: rows
        .map((r) => toPublicPost(r, q.data.locale, false))
        // без русского перевода запись публиковаться не может, но данные
        // могли прийти и мимо нашей валидации — молча пропускаем
        .filter((p) => p !== null),
    });
  } catch (e) {
    return fromError(e);
  }
}
