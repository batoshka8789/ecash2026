'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Logo } from '@/components/ui/Logo';
import { Icon } from '@/components/ui/Icon';

const STORAGE_KEY = 'ecash.appBanner.closed';

/**
 * Нижний баннер «В приложении ещё удобнее».
 * Десктоп — одна строка; мобильный (<640) — лого+текст сверху,
 * чипы сторов во всю ширину снизу (как во фреймах 480/360).
 * Закрытие запоминается в localStorage — баннер не всплывает
 * заново при каждой навигации.
 */
export function AppBanner() {
  const t = useTranslations('appBanner');
  const [closed, setClosed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const dismiss = () => {
    setClosed(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // приватный режим — просто закроем до следующей загрузки
    }
  };

  if (closed) return null;

  return (
    <div className="overflow-hidden bg-surface-page-surf2 pb-[env(safe-area-inset-bottom)]">
      <div className="container-page py-3 sm:py-[23px]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-start gap-3">
            <Logo className="shrink-0 scale-90 origin-left sm:scale-100" />
            <p className="text-xs leading-tight text-text-default sm:max-w-xs sm:text-sm">
              {t('text')}
            </p>
            <button
              type="button"
              onClick={dismiss}
              aria-label={t('close')}
              className="ml-auto inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-text-default transition-colors hover:bg-comp-surface2-hover sm:hidden"
            >
              <Icon name="close" size={18} />
            </button>
          </div>

          <div className="flex items-center gap-2 sm:ml-auto sm:gap-3">
            <StoreChip label="Google play" soon={t('soon')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M4 3.6v16.8c0 .4.4.7.8.5l9-5.2-2.3-2.3L4.8 3.1c-.4-.2-.8 0-.8.5Zm11.5 9.8 2.8-1.6c.4-.2.4-.8 0-1l-2.8-1.6-2.6 2.1 2.6 2.1ZM5.6 2.7l8.6 6.7 2.1-2.1-9.8-5.2c-.3-.2-.7-.1-.9.6Z" />
              </svg>
            </StoreChip>
            <StoreChip label="Apple Store" soon={t('soon')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M16.7 12.9c0-2 1.6-3 1.7-3-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .7 1 1.5 2.1 2.5 2 1-.1 1.4-.7 2.6-.7s1.6.7 2.6.6c1.1 0 1.8-1 2.5-2 .8-1.1 1.1-2.2 1.1-2.3 0 0-2.1-.8-2.2-3Zm-2-5.6c.5-.7.9-1.6.8-2.6-.8 0-1.8.6-2.3 1.2-.5.6-1 1.6-.8 2.5.9.1 1.8-.4 2.3-1.1Z" />
              </svg>
            </StoreChip>
            <button
              type="button"
              onClick={dismiss}
              aria-label={t('close')}
              className="hidden h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-text-default transition-colors hover:bg-comp-surface2-hover sm:inline-flex"
            >
              <Icon name="close" size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Визуальный чип стора. Ссылок на приложения пока нет, поэтому это
 * осознанно НЕ ссылка, а плашка с пометкой «скоро» — чтобы не выглядела
 * кликабельной кнопкой скачивания.
 */
function StoreChip({
  label,
  soon,
  children,
}: {
  label: string;
  soon: string;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-btn-inverted px-4 text-sm font-medium text-text-inverted opacity-80 sm:h-11 sm:flex-none sm:px-5">
      {children}
      <span className="flex flex-col leading-tight">
        {label}
        <span className="text-[10px] font-normal opacity-70">{soon}</span>
      </span>
    </span>
  );
}
