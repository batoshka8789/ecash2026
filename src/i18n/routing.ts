import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['ru', 'en', 'kk', 'zh'],
  defaultLocale: 'ru',
  // «/» — русская версия без префикса, /en, /kk и /zh — с префиксом
  localePrefix: 'as-needed',
});

export type Locale = (typeof routing.locales)[number];
