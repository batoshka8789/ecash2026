'use client';

import { useTranslations } from 'next-intl';

/**
 * Переводит код ошибки бэкенда («errors.wrongPassword») в текст.
 * Ключи лежат в корне messages, поэтому нужен нескоупленный переводчик.
 */
export function useErrorText() {
  const t = useTranslations();
  return (code: string | null | undefined) => {
    if (!code) return '';
    try {
      return t(code);
    } catch {
      return t('errors.unknown');
    }
  };
}
