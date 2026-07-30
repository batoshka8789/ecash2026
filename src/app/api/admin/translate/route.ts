import { NextResponse } from 'next/server';
import { rateLimited, withAdmin } from '@/server/api/guard';
import { body, fail, fromError, ok } from '@/server/api/respond';
import { TranslateError, translateNews } from '@/server/translate';
import { newsTranslateBody } from '@/shared/schemas';
import type { Locale, NewsTranslation } from '@/lib/domain';

/**
 * Машинный перевод новости на другие языки.
 *
 * Ходит наружу и потому ограничен строже прочих админских маршрутов: у
 * переводчика дневная норма на IP, и залипший в цикле редактор выжег бы её
 * за минуту.
 *
 * Языки переводятся параллельно, но внутри одного языка запросы идут
 * очередью — так устроен translateNews. Один язык может не получиться
 * (норма, сбой сети), и это не повод терять остальные: ответ отдаёт то, что
 * перевелось, и отдельно перечисляет, где не вышло.
 */
export const POST = withAdmin(async (req) => {
  if (rateLimited(req, 'admin-translate', 12, 60_000)) return fail('errors.tooManyRequests', 429);

  const parsed = await body(req, newsTranslateBody);
  if (parsed instanceof NextResponse) return parsed;

  const targets = parsed.to.filter((l) => l !== parsed.from);
  if (!targets.length) return ok({ translations: {}, failed: {} });

  try {
    const results = await Promise.all(
      targets.map(async (to) => {
        try {
          return { to, value: await translateNews(parsed.fields, parsed.from, to, req.signal) };
        } catch (e) {
          if (e instanceof TranslateError) return { to, error: e.message };
          throw e;
        }
      }),
    );

    const translations: Partial<Record<Locale, NewsTranslation>> = {};
    const failed: Partial<Record<Locale, string>> = {};
    for (const r of results) {
      if ('value' in r && r.value) translations[r.to] = r.value;
      else if ('error' in r && r.error) failed[r.to] = r.error;
    }

    // ни один язык не перевёлся — это ошибка запроса, а не пустой успех
    if (!Object.keys(translations).length) {
      const first = Object.values(failed)[0] ?? 'errors.translateUnavailable';
      return fail(first, first === 'errors.translateQuota' ? 429 : 502);
    }

    return ok({ translations, failed });
  } catch (e) {
    return fromError(e);
  }
});
