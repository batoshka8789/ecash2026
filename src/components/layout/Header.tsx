'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/ui/Logo';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/lib/auth';
import { ThemeToggle } from './ThemeToggle';
import { LangSwitcher } from './LangSwitcher';

/**
 * Шапка: логотип слева; тема / уведомления / язык / вход|профиль справа.
 * На мобильных (<640) кнопки сжимаются до иконок — как во фреймах 480/360.
 */
export function Header() {
  const t = useTranslations('common');
  const { authed } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-divider-elevated bg-surface-page-surf1">
      <div className="container-page flex h-14 items-center justify-between sm:h-[83px]">
        <Link href="/" aria-label="ecash" className="transition-opacity hover:opacity-80">
          <Logo className="scale-90 origin-left sm:scale-100" />
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          <Link
            href="/notifications"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-btn-1 text-text-default transition-colors hover:bg-comp-surface2-hover sm:h-[50px] sm:w-[50px] sm:rounded-2xl"
            aria-label={t('notifications')}
          >
            <Icon name="notifications" size={20} filled className="sm:text-2xl" />
            {authed && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-positive px-1 text-[10px] font-medium text-text-always-white sm:h-5 sm:min-w-5 sm:text-xs">
                2
              </span>
            )}
          </Link>
          <LangSwitcher />
          <Link
            href={authed ? '/profile' : '/login'}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-btn-1 px-2.5 text-base font-medium text-text-default transition-colors hover:bg-comp-surface2-hover sm:h-[50px] sm:rounded-2xl sm:px-5"
          >
            <span className="hidden sm:inline">{authed ? t('profile') : t('login')}</span>
            <Icon name={authed ? 'person' : 'login'} size={20} filled={authed} />
          </Link>
        </div>
      </div>
    </header>
  );
}
