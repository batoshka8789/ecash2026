'use client';

import { useTranslations } from 'next-intl';

/** Кнопки «Продолжить с Telegram / Google» из модалки авторизации. */
export function SocialButtons() {
  const t = useTranslations('auth');

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        className="relative flex h-12 w-full cursor-pointer items-center justify-center rounded-2xl bg-surface-page-surf2 text-base text-text-default transition-colors hover:bg-comp-surface2-hover"
      >
        <svg
          className="absolute left-4"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="#EEEEEE"
          aria-hidden
        >
          <path d="m2.7 11.2 17.9-6.9c.8-.3 1.6.4 1.3 1.3l-3 14.1c-.2.9-1.2 1.2-1.9.6l-4.3-3.2-2.1 2.1c-.5.5-1.3.3-1.5-.4l-1.5-4.6-4.8-1.5c-.8-.3-.8-1.4-.1-1.5Zm5.5 2.4 1.2 3.9 1.4-1.4-2.6-2.5 8.6-6.4-8.6 6.4Z" />
        </svg>
        {t('withTelegram')}
      </button>
      <button
        type="button"
        className="relative flex h-12 w-full cursor-pointer items-center justify-center rounded-2xl bg-surface-page-surf2 text-base text-text-default transition-colors hover:bg-comp-surface2-hover"
      >
        <svg className="absolute left-4" width="20" height="20" viewBox="0 0 48 48" aria-hidden>
          <path
            fill="#FFC107"
            d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9Z"
          />
          <path
            fill="#FF3D00"
            d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7Z"
          />
          <path
            fill="#4CAF50"
            d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44Z"
          />
          <path
            fill="#1976D2"
            d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9Z"
          />
        </svg>
        {t('withGoogle')}
      </button>
    </div>
  );
}
