'use client';

import { clsx } from 'clsx';

/** Пилюльные табы как в модалке авторизации: тёмная подложка, активная пилюля светлее. */
export function PillTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    /* Макет 847:37405: подложка r24 с padding 4 и gap 4, пилюли 50px r20;
       активная — surface/surf1 (#262626), у неактивной фон совпадает
       с подложкой, поэтому видна только смена цвета текста. */
    <div className={clsx('flex gap-1 rounded-3xl bg-surface-page-bg p-1', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={clsx(
            'h-[50px] flex-1 cursor-pointer rounded-[20px] text-sm font-medium leading-5 transition-colors',
            tab.value === value
              ? 'bg-surface-page-surf1 text-text-default'
              : 'text-text-default hover:text-text-brand',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
