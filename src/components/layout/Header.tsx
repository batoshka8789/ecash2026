'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/ui/Logo';
import { Icon } from '@/components/ui/Icon';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ThemeToggle } from './ThemeToggle';
import { LangSwitcher } from './LangSwitcher';

/**
 * Шапка — 1:1 по макету (Header 1279:104498): слева логотип, справа тема,
 * уведомления с бейджем, «Войти»/«Профиль».
 *
 * Навигации в шапке макет не содержит, и это осознанно: роль навигационного
 * хаба играют карточки-действий на главной, хлебные крошки на внутренних
 * страницах и сайдбар кабинета — ссылки на разделы сюда не возвращаем.
 * Переключатель языка — исключение: в макете он не встречается ни разу (там
 * один язык), но без него сайт не трёхъязычный, поэтому он остаётся тут же,
 * рядом с остальными контролами шапки.
 */
export function Header() {
  const t = useTranslations('common');
  const { authed, loading } = useAuth();

  // реальный счётчик непрочитанных вместо захардкоженного значения
  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: ({ signal }) => api.notifications.list('actual', signal),
    enabled: authed,
    staleTime: 60_000,
    select: (d) => d.unread,
  });

  return (
    <header className="sticky top-0 z-40 border-b border-stroke-surface1 bg-surface-page-surf1">
      <div className="container-page flex h-[72px] items-center justify-between gap-[30px] md:h-[82px]">
        <Link href="/" aria-label="ecash" className="transition-opacity hover:opacity-80">
          <Logo />
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          <Link
            href="/notifications"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-btn-1 text-text-default transition-colors hover:bg-comp-surface2-hover md:h-[50px] md:w-[50px]"
            aria-label={t('notifications')}
          >
            <Icon name="notifications" size={20} filled />
            {authed && typeof unread === 'number' && unread > 0 && (
              <span className="absolute -right-[3px] -top-2 flex h-[19px] min-w-6 items-center justify-center rounded-xl bg-positive px-2 text-sm font-semibold leading-none text-text-always-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Link>

          <LangSwitcher />

          {loading ? (
            // пока сессия загружается — нейтральная заглушка вместо мигания «Войти»
            <span
              aria-hidden
              className="inline-flex h-10 w-10 animate-pulse rounded-2xl bg-btn-1 md:h-[50px] md:w-[114px]"
            />
          ) : (
            <Link
              href={authed ? '/profile' : '/login'}
              className="inline-flex h-10 items-center gap-2 rounded-2xl bg-btn-1 px-2.5 text-sm font-medium leading-5 text-text-default transition-colors hover:bg-comp-surface2-hover md:h-[50px] md:pl-6 md:pr-4"
            >
              <span className="hidden md:inline">{authed ? t('profile') : t('login')}</span>
              <Icon name={authed ? 'person' : 'login'} size={20} filled={authed} />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
