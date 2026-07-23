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
    <div className={clsx('flex rounded-full bg-surface-page-bg p-1', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={clsx(
            'h-11 flex-1 cursor-pointer rounded-full text-base font-medium transition-colors',
            tab.value === value
              ? 'border border-stroke-surface2 bg-surface-page-surf2 text-text-default'
              : 'text-text-default hover:text-text-brand',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
