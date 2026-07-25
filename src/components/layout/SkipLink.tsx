import { useTranslations } from 'next-intl';

/** Скиплинк — первый фокусируемый элемент каждой страницы. Цель: <main id="main">. */
export function SkipLink() {
  const t = useTranslations('common');
  return (
    <a href="#main" className="skip-link">
      {t('skipToContent')}
    </a>
  );
}
