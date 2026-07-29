import 'server-only';
import sharp from 'sharp';

/**
 * Нормализация загруженной картинки перед укладкой в БД: строки в Postgres
 * должны весить сотни килобайт, а не мегабайты, поэтому всё приводится к
 * WebP разумного размера.
 *
 * sharp здесь заодно единственный настоящий валидатор формата: content-type
 * от браузера — это заявление клиента, а sharp смотрит на реальные байты.
 */

/** Предел на вход, до обработки. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Карточка рендерится максимум в 720 CSS-пикселей, при DPR 2 нужно ~1440. */
const MAX_SIDE = 1600;
/** Ориентир по весу строки в БД. */
const TARGET_BYTES = 250 * 1024;
/** Защита от «архивной бомбы»: огромное разрешение при крошечном файле. */
const MAX_PIXELS = 50_000_000;

/**
 * SVG не принимаем сознательно: это документ, а не растр — librsvg умеет
 * тянуть внешние ссылки, то есть картинка превращается в вектор SSRF.
 */
const ALLOWED = new Set(['jpeg', 'png', 'webp', 'avif', 'gif', 'tiff']);

export type ProcessedImage = {
  bytes: Buffer;
  mime: 'image/webp';
  width: number;
  height: number;
  size: number;
};

export type MediaErrorCode = 'fileTooLarge' | 'fileType' | 'fileBroken';

export class MediaError extends Error {
  constructor(
    readonly code: MediaErrorCode,
    readonly status: number,
  ) {
    super(code);
    this.name = 'MediaError';
  }
}

export async function processImage(input: Buffer): Promise<ProcessedImage> {
  if (input.byteLength > MAX_UPLOAD_BYTES) throw new MediaError('fileTooLarge', 413);
  if (input.byteLength === 0) throw new MediaError('fileBroken', 400);

  let meta: sharp.Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: MAX_PIXELS }).metadata();
  } catch {
    throw new MediaError('fileBroken', 400);
  }

  if (!meta.format || !ALLOWED.has(meta.format)) throw new MediaError('fileType', 415);
  if (!meta.width || !meta.height) throw new MediaError('fileBroken', 400);

  const encode = (width: number, quality: number) =>
    sharp(input, { limitInputPixels: MAX_PIXELS })
      // .rotate() без аргумента применяет поворот из EXIF; попутно sharp
      // выбрасывает все метаданные, включая GPS-координаты съёмки
      .rotate()
      .resize({ width, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality, effort: 4 })
      .toBuffer({ resolveWithObject: true });

  // лесенка: сначала теряем качество, потом размер — пока не уложимся в вес
  let out = await encode(MAX_SIDE, 80);
  if (out.info.size > TARGET_BYTES) out = await encode(MAX_SIDE, 66);
  if (out.info.size > TARGET_BYTES) out = await encode(1200, 66);

  return {
    bytes: out.data,
    mime: 'image/webp',
    width: out.info.width,
    height: out.info.height,
    size: out.info.size,
  };
}
