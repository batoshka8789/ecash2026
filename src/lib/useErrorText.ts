'use client';

import { useTranslations } from 'next-intl';

/**
 * Переводит код ошибки бэкенда («errors.INVALID_OTP») в текст.
 *
 * Наличие ключа спрашиваем через t.has, а НЕ пробным вызовом t(): на
 * неизвестном ключе next-intl зовёт свой обработчик ошибок и пишет в консоль
 * IntlError MISSING_MESSAGE — даже когда фоллбэк у нас предусмотрен. Коды
 * приходят от апстрима Ecash, словарь покрывает не все (например
 * INVALID_CLIENT_CREDENTIALS — это ошибка конфигурации, а не для человека),
 * поэтому такой «безобидный» промах случался на каждом рендере с ошибкой и
 * забивал оверлей ошибок Next.
 */
export function useErrorText() {
  const t = useTranslations();
  return (code: string | null | undefined) => {
    if (!code) return '';
    const key = code.startsWith('errors.') ? code : `errors.${code}`;
    if (!t.has(key)) {
      /**
       * Семейство ошибок Camunda — обработчика заявок внутри Ecash. Коды у
       * него плодятся по мере их починок (видели CAMUNDA_TIMEOUT, затем
       * CAMUNDA_START_FAILED), и каждый новый без этого фолбэка показывался
       * бы безликим «Что-то пошло не так» — ровно так человек и узнал о
       * втором коде. Для человека же все они означают одно: заявку сейчас
       * не оформить, ядро не отвечает — говорим это прямо.
       */
      if (key.startsWith('errors.CAMUNDA')) return t('errors.camundaFamily');
      // нет перевода → человеку показываем «непредвиденную ошибку»
      return t('errors.unknown');
    }
    return t(key as Parameters<typeof t>[0]);
  };
}
