'use client';

import { Icon } from './Icon';

type Tone = 'brand' | 'negative' | 'positive';

const tones: Record<Tone, { icon: string; color: string }> = {
  brand: { icon: 'priority_high', color: 'bg-brand text-text-always-white' },
  negative: { icon: 'warning', color: 'text-negative' },
  positive: { icon: 'check_circle', color: 'text-positive' },
};

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
  children: React.ReactNode;
}) {
  const { icon, color } = tones[tone];

  if (!open) return null;

  return (
    <div
      className={
        fixed
          ? 'anim-toast-in fixed left-1/2 top-20 z-50 w-full max-w-[379px] -translate-x-1/2 px-4'
          : 'anim-toast-in flex justify-center px-4'
      }
    >
      {/* «warning»/«alert» из платы Alerts: 347×r24, паддинг 12, gap 12 */}
      <div className="flex w-[347px] max-w-full items-center gap-3 rounded-3xl bg-toast p-3 shadow-[0_16px_32px_-8px_rgb(12_12_13/0.4)]">
        {tone === 'brand' ? (
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${color}`}
          >
            <Icon name={icon} size={20} />
          </span>
        ) : (
          <Icon name={icon} size={24} className={`shrink-0 ${color}`} filled />
        )}
        <div
          role={tone === 'negative' ? 'alert' : 'status'}
          className="min-w-0 flex-1 text-base font-medium leading-5 text-text-default"
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
