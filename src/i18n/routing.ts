import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['ru', 'en', 'kk'],
  defaultLocale: 'ru',
  // «/» — русская версия без префикса, /en и /kk — с префиксом
  localePrefix: 'as-needed',
});

export type Locale = (typeof routing.locales)[number];
