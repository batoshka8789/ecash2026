'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { clsx } from 'clsx';

const labels: Record<Locale, string> = { ru: 'Рус', en: 'Eng', kk: 'Қаз' };

/** Переключатель языка ru / en / kk. */
export function LangSwitcher() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-12 cursor-pointer items-center rounded-2xl bg-btn-1 px-4 text-base font-medium text-text-default transition-colors hover:bg-comp-surface2-hover"
      >
        {labels[locale]}
      </button>
      {open && (
        <div className="absolute right-0 top-14 z-50 min-w-28 overflow-hidden rounded-2xl bg-surface-modal-bg py-2 shadow-lg">
          {routing.locales.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                setOpen(false);
                router.replace(pathname, { locale: l });
              }}
              className={clsx(
                'block w-full cursor-pointer px-4 py-2.5 text-left text-base transition-colors hover:bg-surface-modal-surf1-hover',
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
