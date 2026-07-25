'use client';

import { useTranslations } from 'next-intl';

/**
 * Переводит код ошибки бэкенда («errors.INVALID_OTP») в текст.
 * next-intl не бросает исключение на неизвестном ключе, а возвращает
 * сам ключ — поэтому фоллбэк проверяется сравнением, не try/catch.
 */
export function useErrorText() {
  const t = useTranslations();
  return (code: string | null | undefined) => {
    if (!code) return '';
    const key = code.startsWith('errors.') ? code : `errors.${code}`;
    const text = t(key as Parameters<typeof t>[0]);
    // не нашли перевод → человеку показываем «непредвиденную ошибку»
    return text === key || text.endsWith(`.${key}`) ? t('errors.unknown') : text;
  };
}
