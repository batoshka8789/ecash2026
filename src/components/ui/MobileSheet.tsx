'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';

/**
 * Общий нижний шит для мобильных попапов выбора (валюта, число/месяц/год,
 * отделение и т.д.) — вынесен из Select.tsx, чтобы все пикеры сайта вели
 * себя ОДИНАКОВО: тянется пальцем вниз (порог закрытия 96px), растёт до
 * почти полной высоты при первом скролле контента, блокирует скролл фона.
 * `header` — несворачиваемая шапка (например, поле поиска), `children` —
 * то, что скроллится.
 */
export function MobileSheet({
  open,
  onClose,
  header,
  children,
}: {
  open: boolean;
  onClose: () => void;
  header?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const dragStartRef = useRef(0);
  // синхронное зеркало dragging — pointermove может прийти раньше, чем
  // React перерендерит компонент с новым замыканием после pointerdown
  const draggingRef = useRef(false);

  // фон не скроллится под открытым шитом — иначе снаружи «просвечивает» движение
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Состояние драга не должно пережить закрытие — иначе следующее открытие
  // мигнёт уже сдвинутым/растянутым шитом. Сброс — во время рендера (а не
  // в эффекте): компонент не размонтируется между открытиями (родитель
  // держит его смонтированным и просто переключает open).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    // draggingRef сам обнулится в onDragStart следующего жеста — трогать
    // ref во время рендера нельзя (react-hooks/refs)
    if (!open) {
      setDragging(false);
      setDragY(0);
      setExpanded(false);
    }
  }

  const onDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragStartRef.current = e.clientY;
    draggingRef.current = true;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);
  const onDragMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    setDragY(Math.max(0, e.clientY - dragStartRef.current));
  }, []);
  const onDragEnd = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    setDragY((y) => {
      if (y > 96) onClose();
      return y > 96 ? y : 0;
    });
  }, [onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="anim-modal-scrim fixed inset-0 z-40 bg-scrim"
        onMouseDown={() => onClose()}
        role="presentation"
      />
      <div
        className={clsx(
          'anim-sheet-slide fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-[24px] border border-stroke-modal bg-surface-page-surf2 pb-[max(env(safe-area-inset-bottom),16px)]',
          expanded ? 'max-h-[85vh]' : 'max-h-[60vh]',
          !dragging && 'transition-[transform,max-height] duration-200 ease-out',
        )}
        style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
      >
        <div
          className="flex shrink-0 touch-none justify-center py-3 [cursor:grab] active:[cursor:grabbing]"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          <span aria-hidden className="h-1 w-10 rounded-full bg-stroke-surface3" />
        </div>
        {header && <div className="mx-4 mb-3 shrink-0">{header}</div>}
        {/* открывается на среднюю высоту, доскролленный список сразу же
            вырастает до почти полной — не глотает первые пиксели скролла */}
        <div
          className="min-h-0 flex-1 overflow-auto px-2 pb-2"
          onScroll={(e) => {
            if (!expanded && e.currentTarget.scrollTop > 0) setExpanded(true);
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
}
