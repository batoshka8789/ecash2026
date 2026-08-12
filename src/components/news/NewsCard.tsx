'use client';

import Image from 'next/image';
import { clsx } from 'clsx';
import { Icon } from '@/components/ui/Icon';
import { RichText } from '@/components/ui/RichText';
import { DEFAULT_IMAGE_FOCUS, type ImageFocus } from '@/lib/domain';

/**
 * Карточка новости — ОДИН компонент на ленту и на живое превью в админке.
 * Это единственный способ гарантировать, что превью не разъедется с сайтом:
 * разъезжаться нечему, разметка физически одна.
 */
export function NewsCard({
  image,
  imageFocus = DEFAULT_IMAGE_FOCUS,
  title,
  excerpt,
  excerptRich,
  /** локальный blob-предпросмотр: файл ещё грузится, next/image его не умеет */
  localImage,
  priority = false,
  className,
}: {
  image: string | null;
  /** какая часть обложки уцелеет при обрезке; см. IMAGE_FOCUS */
  imageFocus?: ImageFocus;
  title: string;
  excerpt: string;
  /** начало статьи с оформлением автора; заменяет `excerpt`, когда есть */
  excerptRich?: string;
  localImage?: string | null;
  priority?: boolean;
  className?: string;
}) {
  const src = localImage ?? image;

  return (
    <article
      className={clsx('rounded-2xl bg-surface-page-surf1 p-4 sm:rounded-3xl sm:p-6', className)}
    >
      <div className="relative h-56 w-full overflow-hidden rounded-2xl bg-surface-page-surf2 sm:h-72">
        {src ? (
          localImage ? (
            // blob-URL: обычный img — оптимизатор Next такие адреса не берёт,
            // а CSP их уже разрешает (img-src ... blob:)
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={title}
              style={{ objectPosition: imageFocus }}
              className="h-full w-full object-cover"
            />
          ) : (
            <Image
              src={src}
              alt={title}
              fill
              sizes="(max-width: 768px) 100vw, 720px"
              style={{ objectPosition: imageFocus }}
              className="object-cover"
              priority={priority}
            />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center text-text-disabled">
            <Icon name="image" size={40} />
          </div>
        )}
      </div>

      <h2 className="mt-6 text-lg font-bold text-text-default sm:text-2xl">{title}</h2>

      {/*
        Анонс с оформлением автора (цвет, выделение, размер) — чтобы карточка
        показывала то же, что и статья. Высота карточки при этом не «плывёт»:
        line-clamp держит ровно три строки, а крупный текст (до 1.8em) их
        просто заполняет быстрее. Отступ сверху задан здесь, поэтому первый
        блок внутри RichText свой mt-3 уже не добавляет.
      */}
      {excerptRich ? (
        <div className="mt-3 line-clamp-3 text-sm leading-relaxed text-text-disabled">
          <RichText source={excerptRich} />
        </div>
      ) : (
        excerpt && <p className="mt-3 text-sm leading-relaxed text-text-disabled">{excerpt}</p>
      )}
    </article>
  );
}
