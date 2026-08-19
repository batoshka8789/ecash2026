'use client';

import { useTranslations } from 'next-intl';

/**
 * Переводит ошибку бэкенда в текст для человека.
 *
 * Принимает и голый код («errors.INVALID_OTP»), и саму ошибку (ApiError /
 * Error) — во втором случае у ApiError подхватывается detail: человеческий
 * текст от ядра Ecash. Порядок выбора текста:
 *   1) перевод кода из словаря (все документированные коды переведены);
 *   2) семейный фолбэк CAMUNDA_* — коды этого семейства плодятся;
 *   3) detail — русское message самого ядра: у него появляются
 *      недокументированные коды (AMOUNT_MISMATCH, REQUEST_NOT_CREATED…),
 *      и до этого фолбэка человек видел «Что-то пошло не так», хотя
 *      внятная причина уже лежала в ответе — заказчик прямо просил её
 *      показывать;
 *   4) общий «Что-то пошло не так» — только если не нашлось ничего.
 *
 * Наличие ключа спрашиваем через t.has, а НЕ пробным вызовом t(): на
 * неизвестном ключе next-intl зовёт свой обработчик ошибок и пишет в
 * консоль IntlError MISSING_MESSAGE — даже когда фолбэк предусмотрен.
 */
export function useErrorText() {
  const t = useTranslations();
  return (err: string | Error | null | undefined, detail?: string | null) => {
    if (!err) return '';
    const code = typeof err === 'string' ? err : err.message;
    const upstream =
      detail ??
      (typeof err === 'object' && 'detail' in err ? (err as { detail?: string }).detail : undefined);

    const key = code.startsWith('errors.') ? code : `errors.${code}`;
    if (!t.has(key)) {
      if (key.startsWith('errors.CAMUNDA')) return t('errors.camundaFamily');
      if (upstream) return upstream;
      return t('errors.unknown');
    }
    return t(key as Parameters<typeof t>[0]);
  };
}
