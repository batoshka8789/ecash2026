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
    /* Подложка r24 с padding 4 и gap 4, активная пилюля — surface/surf1
       (#262626); у неактивной фон совпадает с подложкой, поэтому видна
       только смена цвета текста.
       Высота — 54/46, как во всех инстансах tabbar на экранах (модалка
       входа 872:33197 — 400×54), а не 58/50 с платы дизайн-системы. */
    <div className={clsx('flex gap-1 rounded-3xl bg-surface-page-bg p-1', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={clsx(
            'h-[46px] flex-1 cursor-pointer rounded-[20px] text-sm font-medium leading-5 transition-colors',
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
