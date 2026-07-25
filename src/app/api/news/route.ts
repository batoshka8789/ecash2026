import { desc } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { news } from '@/server/db/schema';
import { fromError, ok } from '@/server/api/respond';

/** Новости — наш слой: REST-эндпоинта у Ecash нет (только тема news в SignalR). */
export async function GET() {
  try {
    const rows = await db.select().from(news).orderBy(desc(news.publishedAt));
    return ok({
      posts: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        image: r.image,
        key: r.key,
        publishedAt: r.publishedAt.toISOString(),
      })),
    });
  } catch (e) {
    return fromError(e);
  }
}
