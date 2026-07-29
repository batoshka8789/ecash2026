import { and, eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { news } from '@/server/db/schema';
import { fail, fromError, ok, zodFail } from '@/server/api/respond';
import { toPublicPost } from '@/server/db/news';
import { publicNewsQuery } from '@/shared/schemas';

/** Одна новость целиком — с телом статьи. Черновики недоступны. */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const url = new URL(req.url);
  const q = publicNewsQuery.safeParse(Object.fromEntries(url.searchParams));
  if (!q.success) return zodFail(q.error);

  try {
    const [row] = await db
      .select()
      .from(news)
      .where(and(eq(news.slug, slug), eq(news.status, 'published')));

    const post = row ? toPublicPost(row, q.data.locale, true) : null;
    if (!post) return fail('errors.notFound', 404);
    return ok({ post });
  } catch (e) {
    return fromError(e);
  }
}
