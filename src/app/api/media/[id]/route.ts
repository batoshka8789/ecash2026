import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { media } from '@/server/db/schema';

/**
 * Отдача картинки из БД. Маршрут ПУБЛИЧНЫЙ, и это не упущение:
 * оптимизатор next/image ходит сюда внутренним запросом без куки, поэтому
 * любой гард превратил бы каждую картинку в 401. Роль секрета играет сам
 * uuid, а содержимое новостей и так предназначено для публики.
 *
 * Содержимое по конкретному id неизменяемо (правка обложки создаёт новую
 * строку), поэтому кешируем навсегда, а сам id служит ETag.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CACHE = 'public, max-age=31536000, immutable';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response(null, { status: 404 });

  const etag = `"${id}"`;
  const inm = req.headers.get('if-none-match');
  if (inm === etag || inm === `W/${etag}`) {
    return new Response(null, { status: 304, headers: { etag, 'cache-control': CACHE } });
  }

  // колонки перечислены явно: select() целиком вытянул бы блобы всех строк
  const [row] = await db
    .select({ bytes: media.bytes, mime: media.mime })
    .from(media)
    .where(eq(media.id, id));
  if (!row) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(row.bytes), {
    headers: {
      'content-type': row.mime,
      'content-length': String(row.bytes.byteLength),
      etag,
      'cache-control': CACHE,
    },
  });
}
