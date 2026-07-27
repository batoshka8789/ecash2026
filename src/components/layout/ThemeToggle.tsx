'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/Icon';

const listeners = new Set<() => void>();

/**
 * Тема хранится в cookie и проставляется на <html> сервером.
 * Иконка переключается ЧИСТО через CSS-селектор по html[data-theme] —
 * сервер и клиент рендерят одинаковую разметку (обе иконки), поэтому
 * ни мигания, ни расхождения гидратации нет. JS здесь только переключает
 * атрибут/cookie и обновляет aria-pressed.
 */
const themeStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => document.documentElement.dataset.theme === 'light',
};

export function ThemeToggle() {
  const t = useTranslations('theme');
  const light = useSyncExternalStore(themeStore.subscribe, themeStore.get, () => false);

  const toggle = useCallback(() => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    if (next === 'light') {
      document.documentElement.dataset.theme = 'light';
    } else {
      delete document.documentElement.dataset.theme;
    }
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
    listeners.forEach((l) => l());
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t('label')}
      // pressed = включена светлая тема (тёмная — состояние по умолчанию)
      aria-pressed={light}
      suppressHydrationWarning
      className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl bg-btn-1 text-text-default transition-colors hover:bg-comp-surface2-hover md:h-[50px] md:w-[50px]"
    >
      {/* тёмная тема (нет data-theme) → предлагаем светлую */}
      <span className="inline-flex [html[data-theme=light]_&]:hidden">
        <Icon name="light_mode" size={20} filled />
      </span>
      {/* светлая тема → предлагаем тёмную */}
      <span className="hidden [html[data-theme=light]_&]:inline-flex">
        <Icon name="dark_mode" size={20} filled />
      </span>
    </button>
  );
}
