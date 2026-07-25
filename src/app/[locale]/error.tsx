'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';

/** Ошибка рендера внутри локали: брендированный фолбэк с повтором. */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('system');

  useEffect(() => {
    // digest попадает в серверные логи; здесь — только для отладки в dev
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold text-text-default">{t('errorTitle')}</h1>
      <p className="max-w-md text-text-disabled">{t('errorText')}</p>
      <Button onClick={reset}>{t('retry')}</Button>
    </main>
  );
}
