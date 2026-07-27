'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { clsx } from 'clsx';

const labels: Record<Locale, string> = { ru: 'Рус', en: 'Eng', kk: 'Қаз' };

/**
 * Переключатель языка ru / en / kk.
 * Паттерн listbox: стрелки двигают фокус по опциям, Esc закрывает
 * и возвращает фокус на кнопку, уход фокуса/клик вне — закрывает.
 */
export function LangSwitcher() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  // при открытии — фокус на текущую опцию
  useEffect(() => {
    if (!open) return;
    const idx = Math.max(0, routing.locales.indexOf(locale));
    optionRefs.current[idx]?.focus();
  }, [open, locale]);

  const closeAndRestore = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  // фокус ушёл за пределы компонента (Tab, клик в другой контрол) — закрываем
  const onBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!ref.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
    }
  };

  const onOptionKeyDown = (e: React.KeyboardEvent) => {
    const count = routing.locales.length;
    const active = optionRefs.current.findIndex((el) => el === document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      optionRefs.current[(active + 1 + count) % count]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      optionRefs.current[(active - 1 + count) % count]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeAndRestore();
    }
  };

  return (
    <div ref={ref} className="relative" onBlur={onBlur}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex h-10 cursor-pointer items-center rounded-2xl bg-btn-1 px-4 text-sm font-medium leading-5 text-text-default transition-colors hover:bg-comp-surface2-hover md:h-[50px]"
      >
        {labels[locale]}
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full z-50 mt-2 min-w-28 overflow-hidden rounded-2xl bg-surface-modal-bg py-2 shadow-lg"
        >
          {routing.locales.map((l, i) => (
            <button
              key={l}
              ref={(el) => {
                optionRefs.current[i] = el;
              }}
              type="button"
              role="option"
              aria-selected={l === locale}
              onKeyDown={onOptionKeyDown}
              onClick={() => {
                setOpen(false);
                router.replace(pathname, { locale: l });
              }}
              className={clsx(
                'block w-full cursor-pointer px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-surface-modal-surf1-hover',
                l === locale ? 'text-text-brand' : 'text-text-default',
              )}
            >
              {labels[l]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
