'use client';

import { clsx } from 'clsx';
import { Icon } from './Icon';

type Tone = 'brand' | 'negative' | 'positive';

/** Иконки нейтральных тонов; у brand — собственный вектор из макета. */
const tones: Record<Exclude<Tone, 'brand'>, { icon: string; color: string }> = {
  negative: { icon: 'warning', color: 'text-negative' },
  positive: { icon: 'check_circle', color: 'text-positive' },
};

/**
 * Знак «!» из макета (369:12229) — BOOLEAN_OPERATION «Subtract» 26×26:
 * из оранжевого круга вычтена полоса 2.67×14 в точке 11.67,6. Поэтому знак
 * сквозной (через него виден фон тоста), а точки под ним нет — вырез делаем
 * через fill-rule=evenodd, а не белым глифом поверх круга.
 */
function BrandMark() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 26 26"
      aria-hidden
      focusable="false"
      className="text-brand"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13 0A13 13 0 0 1 26 13A13 13 0 0 1 13 26A13 13 0 0 1 0 13A13 13 0 0 1 13 0ZM11.67 6H14.34V20H11.67V6Z"
      />
    </svg>
  );
}

/**
 * Тост из макета: тёмная пилюля, иконка слева, крестик справа.
 * Появляется сверху с пружиной, уходит вверх.
 */
export function Toast({
  open,
  tone = 'brand',
  onClose,
  closeLabel,
  fixed = true,
  action,
  className,
  children,
}: {
  open: boolean;
  tone?: Tone;
  onClose: () => void;
  closeLabel: string;
  /** fixed — плавает над контентом; иначе встраивается в поток */
  fixed?: boolean;
  /** дополнительная кнопка действия («Открыть заявку») */
  action?: { label: string; onClick: () => void };
  /** классы на саму пилюлю — например вернуть ей клики под pointer-events-none */
  className?: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      className={
        fixed
          ? // те же 12 по краям, что и у встроенного варианта: 371 = 347 + 2×12,
            // поэтому на 360 пилюля выходит макетными 336 (1279:105221),
            // а с 480 она уже помещается целиком и центрируется.
            //
            // Верх: в макете плавающий «alert» стоит на 80 при шапке 73
            // (1279:111810 на 480, 1770:128862) и на 108 при шапке 83
            // (1279:108413 на 1920, 1279:108804 на 1024, 1279:109247 на 768) —
            // то есть зазор под шапкой 7 и 25, ровно как у FirstVisitToast
            'anim-toast-in fixed left-1/2 top-20 z-50 w-full max-w-[371px] -translate-x-1/2 px-3 md:top-[108px]'
          : // уже 371 (347 + поля) пилюля упирается в поля обёртки, поэтому
            // они ровно 12: в макете на 360 пилюля 336 при полях 12
            // (1279:105221), а с 480 она и так помещается и центрируется
            'anim-toast-in flex justify-center px-3'
      }
    >
      {/* «warning»/«alert» из платы Alerts: 347×r24, паддинг 12, gap 12 */}
      <div
        className={clsx(
          'flex w-[347px] max-w-full items-center gap-3 rounded-3xl bg-toast p-3 shadow-[0_16px_32px_-8px_rgb(12_12_13/0.4)]',
          className,
        )}
      >
        {tone === 'brand' ? (
          // в макете (369:12228) бокс иконки 32×32, а сам оранжевый круг —
          // 26×26 по центру
          <span className="flex h-8 w-8 shrink-0 items-center justify-center">
            <BrandMark />
          </span>
        ) : (
          <Icon
            name={tones[tone].icon}
            size={24}
            className={`shrink-0 ${tones[tone].color}`}
            filled
          />
        )}
        <div
          role={tone === 'negative' ? 'alert' : 'status'}
          // подпись «Label» (369:12232): с 768 — Roboto Medium 16/20,
          // ниже — Roboto Regular 14 / 1.1× (15.4px), из-за чего пилюля
          // на 480/360 сжимается с 64 до 56
          className="min-w-0 flex-1 text-sm font-normal leading-[15.4px] text-text-default md:text-base md:font-medium md:leading-5"
        >
          {children}
        </div>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="shrink-0 cursor-pointer rounded-xl bg-brand px-3 py-1.5 text-sm font-medium leading-5 text-text-always-white transition-opacity hover:opacity-90"
          >
            {action.label}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-text-default transition-colors hover:bg-comp-surface2-hover"
        >
          <Icon name="close" size={16} />
        </button>
      </div>
    </div>
  );
}
