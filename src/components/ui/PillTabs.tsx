'use client';

import { clsx } from 'clsx';

/**
 * Пилюльные табы: тёмная подложка, активная пилюля светлее.
 *
 * variant='pill' — исходный рисунок Ecash (пилюли r-full, подпись 16).
 * variant='r20' — рисунок ecash-beta: подложка r24 с padding 4 и gap 4,
 * активная вкладка surface/surf1, подпись 14/20. Второй вариант заведён
 * отдельно, чтобы карточка авторизации могла перейти на новый рисунок,
 * не утаскивая за собой табы уведомлений в профиле.
 */
export function PillTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
  variant = 'pill',
}: {
  tabs: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  variant?: 'pill' | 'r20';
}) {
  const r20 = variant === 'r20';
  return (
    <div
      className={clsx(
        'flex bg-surface-page-bg p-1',
        r20 ? 'gap-1 rounded-3xl' : 'rounded-full',
        className,
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={clsx(
            // px-3 и nowrap: в узком контейнере (например, рядом с полем
            // поиска) подписи иначе наезжали друг на друга
            'flex-1 cursor-pointer whitespace-nowrap px-3 font-medium transition-colors',
            r20
              ? 'h-[46px] rounded-[20px] text-sm leading-5'
              : 'h-11 rounded-full text-base',
            tab.value === value
              ? r20
                ? 'bg-surface-page-surf1 text-text-default'
                : 'border border-stroke-surface2 bg-surface-page-surf2 text-text-default'
              : 'text-text-default hover:text-text-brand',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
