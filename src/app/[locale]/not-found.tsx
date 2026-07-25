import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

/** 404 внутри локали: с шапкой темы и ссылкой на главную. */
export default function LocaleNotFound() {
  const t = useTranslations('system');

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-6xl font-bold text-text-brand">404</p>
      <h1 className="text-2xl font-bold text-text-default">{t('notFoundTitle')}</h1>
      <p className="max-w-md text-text-disabled">{t('notFoundText')}</p>
      <Link
        href="/"
        className="inline-flex h-12 items-center rounded-2xl bg-brand px-6 font-medium text-text-always-white transition-opacity hover:opacity-90"
      >
        {t('toHome')}
      </Link>
    </main>
  );
}
