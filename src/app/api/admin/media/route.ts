import { db } from '@/server/db/client';
import { media } from '@/server/db/schema';
import { rateLimited, withAdmin } from '@/server/api/guard';
import { fail, fromError, ok } from '@/server/api/respond';
import { MAX_UPLOAD_BYTES, MediaError, processImage } from '@/server/media/process';

/**
 * Загрузка обложки. Файл приходит сырым телом с `content-type: image/*`,
 * а не multipart: парсить multipart незачем, а заодно это лишний барьер для
 * межсайтовой отправки — на такой content-type браузер шлёт preflight
 * (в дополнение к checkOrigin внутри withAdmin).
 */
export const POST = withAdmin(async (req, _token, { account }) => {
  if (rateLimited(req, 'admin-media', 30, 60_000)) return fail('errors.tooManyRequests', 429);

  const type = req.headers.get('content-type') ?? '';
  if (!type.startsWith('image/')) return fail('errors.fileType', 415);

  // отсекаем заведомо большой файл до чтения тела в память
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > MAX_UPLOAD_BYTES) return fail('errors.fileTooLarge', 413);

  try {
    const input = Buffer.from(await req.arrayBuffer());
    const img = await processImage(input);

    const [row] = await db
      .insert(media)
      .values({
        bytes: img.bytes,
        mime: img.mime,
        width: img.width,
        height: img.height,
        size: img.size,
        uploadedBy: account.accountId,
      })
      .returning({ id: media.id });

    return ok(
      { media: { id: row.id, url: `/api/media/${row.id}`, width: img.width, height: img.height, size: img.size } },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof MediaError) return fail(`errors.${e.code}`, e.status);
    return fromError(e);
  }
});
