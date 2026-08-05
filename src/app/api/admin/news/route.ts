import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { news } from '@/server/db/schema';
import { rateLimited, withAdmin } from '@/server/api/guard';
import { body, fail, fromError, ok, zodFail } from '@/server/api/respond';
import { slugify, toAdminPost } from '@/server/db/news';
import { ensureNewsTranslations } from '@/server/news-autotranslate';
import { adminNewsQuery, newsCreateBody } from '@/shared/schemas';
import { isUniqueViolation } from '@/server/db/errors';

/** Библиотека: всё, включая черновики, со всеми переводами. */
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url);
  const q = adminNewsQuery.safeParse(Object.fromEntries(url.searchParams));
  if (!q.success) return zodFail(q.error);

  try {
    const rows = await db
      .select()
      .from(news)
      .where(q.data.status === 'all' ? undefined : eq(news.status, q.data.status))
      .orderBy(desc(news.updatedAt));

    const posts = rows.map(toAdminPost);
    const needle = q.data.q?.toLowerCase();
    return ok({
      posts: needle
        ? posts.filter(
            (p) =>
              p.slug.includes(needle) ||
              Object.values(p.translations).some((t) => t?.title.toLowerCase().includes(needle)),
          )
        : posts,
    });
  } catch (e) {
    return fromError(e);
  }
});

export const POST = withAdmin(async (req, _token, { account }) => {
  if (rateLimited(req, 'admin-news', 60, 60_000)) return fail('errors.tooManyRequests', 429);

  const parsed = await body(req, newsCreateBody);
  if (parsed instanceof NextResponse) return parsed;

  // адрес не задан — выводим из русского заголовка; пустой (например,
  // заголовок целиком иероглифами) заменяем на дату, чтобы не падать
  const slug =
    parsed.slug ||
    slugify(parsed.translations.ru.title) ||
    `news-${new Date().toISOString().slice(0, 10)}`;

  try {
    const [row] = await db
      .insert(news)
      .values({
        slug,
        image: parsed.image,
        imageFocus: parsed.imageFocus,
        translations: parsed.translations,
        status: parsed.status,
        authorAccountId: account.accountId,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // перевод догоняет запись в фоне — ответ редактору не ждёт переводчика
    void ensureNewsTranslations(row.id);

    return ok({ post: toAdminPost(row) }, { status: 201 });
  } catch (e) {
    if (isUniqueViolation(e)) return fail('errors.slugTaken', 409, { field: 'slug' });
    return fromError(e);
  }
});
