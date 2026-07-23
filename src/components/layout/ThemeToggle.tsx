'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

const listeners = new Set<() => void>();

/**
 * Тема хранится в cookie и проставляется на <html> сервером — поэтому
 * нет ни мигания, ни расхождения гидратации. Здесь только чтение
 * текущего значения из DOM и переключение.
 */
const themeStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => document.documentElement.dataset.theme === 'light',
};

export function ThemeToggle() {
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
    <Button variant="surf1" size="icon-lg" onClick={toggle} aria-label="Сменить тему">
      <Icon name={light ? 'dark_mode' : 'light_mode'} filled />
    </Button>
  );
}
