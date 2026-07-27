'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { AuthCard } from './AuthCard';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Модалка входа/регистрации поверх прерванного действия (бронь, подписка
 * и т. п.): гость видит курсы без входа, а вход просят только в момент
 * попытки что-то сделать — без перехода на /login и потери введённых
 * в форму данных. onAuthed вызывается после успешного входа/регистрации,
 * чтобы вызывающий флоу продолжил прерванное действие. Оболочка — тот же
 * паттерн, что и у FranchiseModal/AddressModal (фокус-ловушка, Esc,
 * блокировка скролла, клик по фону).
 */
export function AuthModal({
  open,
  onClose,
  onAuthed,
}: {
  open: boolean;
  onClose: () => void;
  onAuthed: () => void;
}) {
  const t = useTranslations('auth');
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    containerRef.current?.querySelector('input')?.focus();
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
    // стандартный паттерн «клик по подложке закрывает модалку»; клавиатурный
    // выход — Esc (обработан выше), мышиный — сюда, обе не мешают друг другу
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className="anim-modal-scrim fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-scrim p-4 py-10"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={t('tabs.login')}
    >
      <div ref={containerRef} className="anim-modal-card w-full max-w-[480px]">
        <AuthCard onClose={onClose} onSuccess={onAuthed} />
      </div>
    </div>
  );
}
