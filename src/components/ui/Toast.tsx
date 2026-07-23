'use client';

import { AnimatePresence, motion } from 'framer-motion';
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
  children,
}: {
  open: boolean;
  tone?: Tone;
  onClose: () => void;
  closeLabel: string;
  /** fixed — плавает над контентом; иначе встраивается в поток */
  fixed?: boolean;
  children: React.ReactNode;
}) {
  const { icon, color } = tones[tone];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          className={
            fixed
              ? 'fixed left-1/2 top-20 z-50 -translate-x-1/2 px-4'
              : 'flex justify-center'
          }
        >
          <div className="flex items-center gap-3 rounded-2xl bg-toast py-3 pl-4 pr-2 shadow-[0_8px_24px_rgb(0_0_0/0.3)]">
            {tone === 'brand' ? (
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${color}`}>
                <Icon name={icon} size={16} />
              </span>
            ) : (
              <Icon name={icon} size={22} className={`shrink-0 ${color}`} filled />
            )}
            <div className="max-w-56 text-sm leading-tight text-text-default">{children}</div>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="ml-1 inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-text-default transition-colors hover:bg-comp-surface2-hover"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
