import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { news } from '@/server/db/schema';
import { rateLimited, withAdmin } from '@/server/api/guard';
import { body, fail, fromError, ok } from '@/server/api/respond';
import { normalizeTranslations, toAdminPost } from '@/server/db/news';
import { isUniqueViolation } from '@/server/db/errors';
import { isBodyEmpty } from '@/lib/richtext-doc';
import { newsPatchBody } from '@/shared/schemas';
import type { NewsTranslations } from '@/lib/domain';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = withAdmin(async (_req, _token, ctx) => {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return fail('errors.notFound', 404);

  try {
    const [row] = await db.select().from(news).where(eq(news.id, id));
    if (!row) return fail('errors.notFound', 404);
    return ok({ post: toAdminPost(row) });
  } catch (e) {
    return fromError(e);
  }
});

export const PATCH = withAdmin(async (req, _token, ctx) => {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return fail('errors.notFound', 404);
  if (rateLimited(req, 'admin-news', 60, 60_000)) return fail('errors.tooManyRequests', 429);

  const parsed = await body(req, newsPatchBody);
  if (parsed instanceof NextResponse) return parsed;

  try {
    const [current] = await db.select().from(news).where(eq(news.id, id));
    if (!current) return fail('errors.notFound', 404);

    // переводы сливаются по локалям: правка английского не должна стирать
    // русский. null удаляет язык, но русский удалить нельзя — на нём держится
    // фолбэк для всех остальных.
    let translations = normalizeTranslations(current.translations);
    if (parsed.translations) {
      const next: NewsTranslations = { ...translations };
      for (const [locale, value] of Object.entries(parsed.translations)) {
        const key = locale as keyof NewsTranslations;
        if (value === null) {
          if (key !== 'ru') delete next[key];
        } else if (value) {
          next[key] = value;
        }
      }
      translations = next;
    }

    const status = parsed.status ?? current.status;
    if (status === 'published') {
      const ru = translations.ru;
      if (!ru?.title || isBodyEmpty(ru.body)) return fail('errors.newsRuRequired', 422);
    }

    const [row] = await db
      .update(news)
      .set({
        ...(parsed.slug ? { slug: parsed.slug } : {}),
        ...(parsed.image !== undefined ? { image: parsed.image } : {}),
        ...(parsed.imageFocus ? { imageFocus: parsed.imageFocus } : {}),
        translations,
        status,
        updatedAt: new Date(),
        // дата публикации отсчитывается от момента, когда новость показали
        ...(status === 'published' && current.status !== 'published'
          ? { publishedAt: new Date() }
          : {}),
      })
      .where(eq(news.id, id))
      .returning();

    return ok({ post: toAdminPost(row) });
  } catch (e) {
    if (isUniqueViolation(e)) return fail('errors.slugTaken', 409, { field: 'slug' });
    return fromError(e);
  }
});

export const DELETE = withAdmin(async (req, _token, ctx) => {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return fail('errors.notFound', 404);
  if (rateLimited(req, 'admin-news', 60, 60_000)) return fail('errors.tooManyRequests', 429);

  try {
    const [row] = await db.delete(news).where(eq(news.id, id)).returning({ id: news.id });
    if (!row) return fail('errors.notFound', 404);
    return ok({ ok: true });
  } catch (e) {
    return fromError(e);
  }
});
