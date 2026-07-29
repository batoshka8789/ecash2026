'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';

export type Device = 'mobile' | 'desktop';

/** Ширина области просмотра, которую изображаем. */
const WIDTH: Record<Device, number> = { mobile: 390, desktop: 1280 };

/**
 * Рамка устройства для живого превью.
 *
 * Содержимое рендерится в НАСТОЯЩУЮ ширину устройства и уменьшается
 * трансформацией под ширину колонки. Так срабатывают все брейкпоинты Tailwind
 * (`sm:`, `lg:`), и десктопная вёрстка видна именно десктопной — тогда как
 * простое сужение колонки показывало бы мобильный вариант всегда, что и было
 * заметно раньше.
 *
 * Высоту оболочки задаём вручную: масштабированный элемент занимает в потоке
 * исходный размер, поэтому без этого под превью зияла бы пустота.
 */
export function DeviceFrame({
  device,
  url,
  children,
}: {
  device: Device;
  /** адрес в строке браузера — показывает, куда попадёт новость */
  url: string;
  children: React.ReactNode;
}) {
  // меряем именно внешнюю обёртку: сама рамка ниже ограничена по ширине
  // результатом измерения, и наблюдение за ней замкнуло бы ResizeObserver
  const outerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);
  const width = WIDTH[device];

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const content = contentRef.current;
    if (!outer || !content) return;

    const measure = () => {
      const next = Math.min(1, outer.clientWidth / width);
      setScale((prev) => (Math.abs(prev - next) < 0.001 ? prev : next));
      setHeight((prev) => {
        const h = content.scrollHeight * next;
        return Math.abs(prev - h) < 1 ? prev : h;
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(content);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div ref={outerRef}>
      <div
        style={{ maxWidth: width * scale }}
        className={clsx(
          'mx-auto overflow-hidden border border-stroke-surface2 bg-surface-page-bg',
          device === 'mobile' ? 'rounded-[28px]' : 'rounded-2xl',
        )}
      >
        <Chrome device={device} url={url} />
        <div style={{ height }} className="overflow-hidden">
          <div
            ref={contentRef}
            style={{ width, transform: `scale(${scale})`, transformOrigin: 'top left' }}
            className="bg-surface-page-bg"
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Верхняя планка: у телефона — статус-бар, у десктопа — строка браузера. */
function Chrome({ device, url }: { device: Device; url: string }) {
  if (device === 'mobile') {
    return (
      <div className="flex items-center justify-center border-b border-stroke-surface2 bg-surface-page-surf1 py-2.5">
        <span aria-hidden className="h-1.5 w-24 rounded-full bg-surface-page-surf3" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 border-b border-stroke-surface2 bg-surface-page-surf1 px-3 py-2">
      <span aria-hidden className="flex gap-1.5">
        {['bg-negative', 'bg-brand', 'bg-positive'].map((c) => (
          <span key={c} className={clsx('h-2.5 w-2.5 rounded-full opacity-70', c)} />
        ))}
      </span>
      <span className="ml-1 min-w-0 flex-1 truncate rounded-full bg-surface-page-surf3 px-3 py-1 text-[11px] text-text-disabled">
        {url}
      </span>
    </div>
  );
}
