'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { useTranslations } from 'next-intl';
import { Logo } from '@/components/ui/Logo';
import { Icon } from '@/components/ui/Icon';

const STORAGE_KEY = 'ecash.appBanner.closed';

/**
 * Нижний баннер «В приложении ещё удобнее» (banner, 607:16416).
 *
 * Раскладка по брейкпоинтам макета:
 *   ≥1024 — одна строка 94px: лого+текст слева (зазор 32), чипы сторов
 *           фиксированной ширины 144/143 и крестик справа (зазор 28 между ними);
 *   768–1023 — колонка 158px: строка «лого+текст» (зазор 32), под ней два чипа по 328;
 *   480–767 — колонка 158px, боковое поле 16, зазор лого↔текст 16 (в макете он
 *             задан переопределением инстанса — только с ним подпись
 *             укладывается в две строки и баннер выходит ровно 158px);
 *   <480 — колонка 204px: лого НАД текстом (зазор 16), текст во всю ширину.
 *
 * Боковые поля собственные, шире, чем у шапки и футера: 16 / 52 / 84,
 * а на широких экранах колонка ограничена 1200 (1368 = 1200 + 2×84).
 *
 * Крестик ниже 1024 в макете абсолютный — 16px от верха баннера и 16px от
 * правого края, а первой строке под него зарезервирован padding-right 40.
 *
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
    <div className="relative overflow-hidden bg-surface-page-surf3 pb-[env(safe-area-inset-bottom)] shadow-[0_4px_8px_0_rgb(0_0_0/4%),0_0_2px_0_rgb(0_0_0/8%)]">
      <div className="mx-auto w-full max-w-[1368px] px-4 py-6 md:px-[52px] lg:px-[84px]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          {/* зазор лого↔текст: 16 до 768, 32 от 768 и выше */}
          <div className="flex flex-col gap-4 pr-10 min-[480px]:flex-row min-[480px]:items-center md:gap-8 lg:flex-1 lg:pr-0">
            <Logo className="shrink-0" />
            <p className="text-sm leading-[15px] text-text-default lg:max-w-[309px] lg:font-medium">
              {t('text')}
            </p>
          </div>

          <div className="flex items-center gap-2 lg:ml-auto">
            <StoreChip label="Google play" className="lg:w-[144px]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M4 3.6v16.8c0 .4.4.7.8.5l9-5.2-2.3-2.3L4.8 3.1c-.4-.2-.8 0-.8.5Zm11.5 9.8 2.8-1.6c.4-.2.4-.8 0-1l-2.8-1.6-2.6 2.1 2.6 2.1ZM5.6 2.7l8.6 6.7 2.1-2.1-9.8-5.2c-.3-.2-.7-.1-.9.6Z" />
              </svg>
            </StoreChip>
            <StoreChip label="Apple Store" className="lg:w-[143px]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M16.7 12.9c0-2 1.6-3 1.7-3-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .7 1 1.5 2.1 2.5 2 1-.1 1.4-.7 2.6-.7s1.6.7 2.6.6c1.1 0 1.8-1 2.5-2 .8-1.1 1.1-2.2 1.1-2.3 0 0-2.1-.8-2.2-3Zm-2-5.6c.5-.7.9-1.6.8-2.6-.8 0-1.8.6-2.3 1.2-.5.6-1 1.6-.8 2.5.9.1 1.8-.4 2.3-1.1Z" />
              </svg>
            </StoreChip>
            {/* ≥1024 — крестик в строке, зазор до чипов 28 = gap 8 + ml 20 */}
            <button
              type="button"
              onClick={dismiss}
              aria-label={t('close')}
              className="hidden h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-text-default transition-colors hover:bg-comp-surface2-hover lg:ml-5 lg:inline-flex"
            >
              <Icon name="close" size={24} />
            </button>
          </div>
        </div>
      </div>

      {/* <1024 — крестик вне потока: 16px от верха баннера и от правого края */}
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('close')}
        className="absolute right-4 top-4 inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-text-default transition-colors hover:bg-comp-surface2-hover lg:hidden"
      >
        <Icon name="close" size={24} />
      </button>
    </div>
  );
}

/**
 * Визуальный чип стора (a-button-main M, 847:36864): 46px, r20, заливка
 * surface/inverted, padding 16/24, иконка 20 с зазором 8, подпись
 * Roboto Medium 14/20. Ссылок на приложения пока нет, поэтому это
 * осознанно НЕ ссылка, а плашка.
 *
 * Ниже 1024 чипы тянутся поровну (`flex-1`) и дают макетные 328/220/160,
 * а от 1024 ширина в макете фиксированная и разная у чипов (144 и 143) —
 * её передаёт вызывающий код через className.
 */
function StoreChip({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={clsx(
        'inline-flex h-[46px] flex-1 items-center justify-center gap-2 rounded-[20px] bg-btn-inverted pl-4 pr-6 text-sm font-medium leading-5 text-text-inverted lg:flex-none',
        className,
      )}
    >
      {children}
      {label}
    </span>
  );
}
