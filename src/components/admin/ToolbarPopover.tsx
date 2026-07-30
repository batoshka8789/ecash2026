'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { Icon } from '@/components/ui/Icon';

/**
 * Выпадающая панель инструмента (цвет, шрифт, размер, ссылка), вынесенная
 * порталом в document.body.
 *
 * Панель форматирования прокручивается горизонтально (`overflow-x-auto`), а
 * по спецификации CSS Overflow, если задать только overflow-x, overflow-y
 * молча становится `auto` — контейнер начинает обрезАть и по вертикали.
 * Обычный `position: absolute` внутри такого контейнера обрезался бы
 * невидимым: цветовая палитра и список шрифтов физически существовали в DOM,
 * но не показывались НИ ПИКСЕЛЕМ. Портал + `position: fixed`, посчитанный от
 * реальных координат кнопки, полностью выносит панель из-под чужого overflow
 * — её больше не может обрезать никакой родитель, сейчас и в будущем.
 */
export function ToolbarPopover({
  icon,
  label,
  active,
  panelClassName,
  onBeforeOpen,
  children,
}: {
  icon: string;
  label: string;
  active?: boolean;
  /** доп. классы панели — напр. ширина, отличная от дефолтной */
  panelClassName?: string;
  /** вызывается синхронно перед открытием — напр. подставить текущий адрес ссылки в черновик */
  onBeforeOpen?: () => void;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    onBeforeOpen?.();
    const rect = btnRef.current!.getBoundingClientRect();
    setPos({ top: rect.bottom + 8, left: rect.left });
    setOpen(true);
  };

  // после первого рендера панели — подвинуть, если она вылезла за вьюпорт
  useLayoutEffect(() => {
    if (!open || !panelRef.current) return;
    const panel = panelRef.current.getBoundingClientRect();
    const margin = 8;
    let { top, left } = pos!;
    if (panel.right > window.innerWidth - margin) left = window.innerWidth - panel.width - margin;
    if (left < margin) left = margin;
    if (panel.bottom > window.innerHeight - margin) {
      const btn = btnRef.current!.getBoundingClientRect();
      top = btn.top - panel.height - 8; // не влезает снизу — открываем вверх
    }
    if (top !== pos!.top || left !== pos!.left) setPos({ top, left });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- пересчитать только при открытии, не на каждый setPos
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    // скролл где угодно (в т.ч. внутри прокручиваемой панели инструментов)
    // сдвигает координаты кнопки — проще закрыть, чем на лету пересчитывать
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title={label}
        aria-label={label}
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggle}
        className={clsx(
          'inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors',
          active || open ? 'bg-brand-hardsoft text-text-brand' : 'text-text-default hover:bg-comp-surface2-hover',
        )}
      >
        <Icon name={icon} size={20} />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: 'fixed', top: pos.top, left: pos.left }}
            className={clsx(
              'anim-popover z-50 rounded-2xl border border-stroke-surface2 bg-surface-page-surf1 p-3 shadow-[0_20px_48px_-12px_rgba(12,12,13,0.55)]',
              panelClassName ?? 'min-w-[200px]',
            )}
          >
            {children(() => setOpen(false))}
          </div>,
          document.body,
        )}
    </>
  );
}
