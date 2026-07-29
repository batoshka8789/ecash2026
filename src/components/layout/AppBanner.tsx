'use client';

import { useSyncExternalStore } from 'react';
import { clsx } from 'clsx';
import { useTranslations } from 'next-intl';
import { Logo } from '@/components/ui/Logo';
import { Icon } from '@/components/ui/Icon';

const STORAGE_KEY = 'ecash.appBanner.closed';

/**
 * Мини-хранилище «баннер закрыт» для useSyncExternalStore.
 *
 * В приватном режиме доступ к localStorage бросает — тогда считаем баннер
 * открытым: лучше показать лишний раз, чем уронить рендер.
 */
const closedListeners = new Set<() => void>();

function subscribeClosed(onChange: () => void): () => void {
  closedListeners.add(onChange);
  return () => {
    closedListeners.delete(onChange);
  };
}

function readClosed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function emitClosed(): void {
  for (const fn of closedListeners) fn();
}

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
  /*
    Состояние берём через useSyncExternalStore с ОТДЕЛЬНЫМ серверным
    снимком — раньше localStorage читался прямо в инициализаторе useState.
    Инициализатор выполняется на первом рендере: на сервере window нет и
    баннер попадал в HTML, а в браузере у того, кто его закрывал, тот же
    первый рендер возвращал null. Разметка не совпадала, и React ронял всё
    дерево страницы с «Hydration failed».

    Серверный снимок всегда false, поэтому гидратация видит ту же разметку,
    что отдал сервер, а сразу после неё React перечитывает клиентский снимок
    и прячет баннер. Это штатный для React способ, в отличие от setState в
    эффекте (его запрещает react-hooks/set-state-in-effect).
  */
  const closed = useSyncExternalStore(subscribeClosed, readClosed, () => false);

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // приватный режим — просто закроем до следующей загрузки
    }
    emitClosed();
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
            <StoreChip label="Google play" soon={t('soon')} className="lg:w-[144px]">
              {/* знак Google Play из набора макета (play market.svg) */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M5.34076 1.55917L17.3711 8.47633L14.7925 11.0549L5.34076 1.55917ZM2.84834 1L13.8914 12L2.84926 23C2.28734 22.7516 1.90234 22.1988 1.90234 21.5562C1.90234 21.5352 1.90234 21.5141 1.90326 21.4939V21.4967V2.50425C1.90234 2.48683 1.90234 2.46575 1.90234 2.44467C1.90234 1.80208 2.28734 1.24933 2.83918 1.00458L2.84926 1.00092L2.84834 1ZM21.1102 10.7112C21.4897 10.9926 21.7326 11.4399 21.7326 11.9432C21.7326 11.9633 21.7326 11.9826 21.7317 12.0028V12C21.7353 12.0394 21.7381 12.0862 21.7381 12.1329C21.7381 12.6059 21.5089 13.0258 21.1551 13.2861L21.1514 13.2888L18.5728 14.7491L15.7807 12L18.5738 9.20692L21.1102 10.7112ZM5.34076 22.4408L14.7934 12.9451L17.372 15.5237L5.34076 22.4408Z"
                  fill="currentColor"
                />
              </svg>
            </StoreChip>
            <StoreChip label="Apple Store" soon={t('soon')} className="lg:w-[143px]">
              {/* знак App Store из набора макета (app store.svg) */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M19.8117 19.8756C20.4607 18.8856 20.7027 18.3797 21.1977 17.2687C17.5457 15.8827 16.9627 10.6798 20.5707 8.68884C19.4707 7.30286 17.9197 6.49989 16.4568 6.49989C15.4008 6.49989 14.6748 6.7749 14.0258 7.02789C13.4758 7.23689 12.9808 7.42387 12.3648 7.42387C11.7049 7.42387 11.1219 7.21489 10.5059 6.99489C9.83489 6.7529 9.1309 6.49989 8.25091 6.49989C6.61195 6.49989 4.86298 7.50087 3.75201 9.21684C2.19004 11.6368 2.46504 16.1687 4.98399 20.0406C5.88597 21.4266 7.09594 22.9776 8.66891 22.9996C9.3289 23.0106 9.75789 22.8126 10.2309 22.6036C10.7699 22.3616 11.3529 22.0976 12.3758 22.0976C13.3988 22.0866 13.9708 22.3616 14.5098 22.6036C14.9718 22.8126 15.3898 23.0106 16.0388 22.9996C17.6337 22.9776 18.9097 21.2616 19.8117 19.8756Z"
                  fill="currentColor"
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M16.2258 1C16.4018 2.20998 15.9068 3.40897 15.2578 4.24495C14.5648 5.14693 13.3548 5.8509 12.1888 5.8069C11.9798 4.64092 12.5188 3.44194 13.1788 2.63896C13.9158 1.75897 15.1588 1.077 16.2258 1Z"
                  fill="currentColor"
                />
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
 * осознанно НЕ ссылка, а плашка с пометкой «скоро» — чтобы не выглядела
 * кликабельной кнопкой скачивания.
 *
 * Ниже 1024 чипы тянутся поровну (`flex-1`) и дают макетные 328/220/160,
 * а от 1024 ширина в макете фиксированная и разная у чипов (144 и 143) —
 * её передаёт вызывающий код через className.
 */
function StoreChip({
  label,
  soon,
  className,
  children,
}: {
  label: string;
  soon: string;
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
      <span className="flex flex-col leading-tight">
        {label}
        <span className="text-[10px] font-normal opacity-70">{soon}</span>
      </span>
    </span>
  );
}
