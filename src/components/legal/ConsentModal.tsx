'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { CONSENT_TITLE, CONSENT_VERSION } from '@/lib/legal/consent';
import { ConsentBody } from './ConsentBody';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Согласие прямо поверх формы регистрации.
 *
 * Раньше ссылка уводила на отдельную страницу в соседней вкладке, и путь
 * получался длинным: открыть → прочитать → уйти обратно → найти галочку →
 * продолжить. Здесь человек читает не сходя с формы и принимает одной
 * кнопкой: окно закрывается, галочка встаёт, поля на месте.
 *
 * Страница `/legal/consent` при этом остаётся — документ нужен и сам по
 * себе: ссылкой из подвала, по прямому адресу, для поисковых систем.
 * Текст у них общий (ConsentBody), разойтись не может.
 *
 * Оболочка — тот же паттерн, что у AuthModal/AddressModal: фокус-ловушка,
 * Esc, блокировка прокрутки страницы, клик по фону.
 */
export function ConsentModal({
  open,
  onClose,
  onAccept,
}: {
  open: boolean;
  onClose: () => void;
  /** нажали «Принимаю» — вызывающий ставит галочку и закрывает окно */
  onAccept: () => void;
}) {
  const t = useTranslations('legal');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    // фокус — на область текста: сразу работают стрелки и PageDown
    scrollRef.current?.focus();
    return () => {
      if (prev instanceof HTMLElement) prev.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = containerRef.current;
      if (!root) return;
      const focusables = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !root.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    // клик по подложке закрывает — как в остальных модалках; клавиатурный
    // выход это Esc, обработан выше
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className="anim-modal-scrim fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={CONSENT_TITLE}
    >
      {/*
        Высота ограничена экраном, прокручивается ТОЛЬКО текст: шапка с
        заголовком и подвал с кнопкой остаются на виду. Иначе на телефоне
        кнопка «Принимаю» уезжала бы за 44 экрана текста.
      */}
      <div
        ref={containerRef}
        className="anim-modal-card flex max-h-[calc(100dvh-2rem)] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl bg-surface-page-surf1 sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-stroke-surface2 p-5 sm:p-6">
          <div className="min-w-0">
            <h2 className="text-base font-bold leading-snug text-text-default sm:text-xl">
              {CONSENT_TITLE}
            </h2>
            <p className="mt-1 text-xs text-text-disabled">
              {t('version', { version: CONSENT_VERSION })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-surface-page-surf2 text-text-default transition-colors hover:bg-comp-surface2-hover"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <div
          ref={scrollRef}
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 sm:px-6"
        >
          <ConsentBody withTitle={false} />
        </div>

        <div className="flex flex-col gap-3 border-t border-stroke-surface2 p-5 sm:flex-row-reverse sm:items-center sm:p-6">
          <Button type="button" size="lg" className="w-full sm:w-auto" onClick={onAccept}>
            {t('acceptAndContinue')}
          </Button>
          <p className="text-xs leading-[1.4] text-text-disabled sm:flex-1">{t('acceptNote')}</p>
        </div>
      </div>
    </div>
  );
}
