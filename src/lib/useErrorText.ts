'use client';

import { useTranslations } from 'next-intl';

/**
 * Переводит код ошибки бэкенда («errors.INVALID_OTP») в текст.
 *
 * Кодов у апстрима больше, чем ключей в messages: наличие перевода проверяем
 * заранее через t.has(). Если звать t() на отсутствующем ключе, next-intl
 * вернёт сам ключ, но попутно напишет в консоль MISSING_MESSAGE — на страницах
 * с недоступным апстримом это давало по десятку ошибок на загрузку.
 */
export function useErrorText() {
  const t = useTranslations();
  return (code: string | null | undefined) => {
    if (!code) return '';
    const key = (code.startsWith('errors.') ? code : `errors.${code}`) as Parameters<
      typeof t.has
    >[0];
    // не нашли перевод → человеку показываем «непредвиденную ошибку»
    return t.has(key) ? t(key) : t('errors.unknown');
  };
}
