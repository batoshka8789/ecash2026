'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/ui/Logo';
import { Icon } from '@/components/ui/Icon';
import { MaskGlyph } from '@/components/ui/MaskGlyph';
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
    <header className="sticky top-0 z-40 border-b border-divider-elevated bg-surface-page-surf1">
      <div className="container-page flex h-14 items-center justify-between gap-4 sm:h-[83px]">
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
            {/* контурный колокольчик с отдельным язычком — альфа-маска из
                PNG-экспорта макета (кастомный глиф, в наборах его нет);
                22×24 на бейдже 50, на мобильном пропорционально меньше */}
            <MaskGlyph
              src="/img/actions/bell-header.png"
              className="h-[17px] w-4 sm:h-6 sm:w-[22px]"
            />
            {authed && typeof unread === 'number' && unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-positive px-1 text-[10px] font-medium text-text-always-white sm:h-5 sm:min-w-5 sm:text-xs">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Link>

          <LangSwitcher />

          {loading ? (
            // пока сессия загружается — нейтральная заглушка вместо мигания «Войти»
            <span
              aria-hidden
              className="inline-flex h-9 w-16 animate-pulse rounded-xl bg-btn-1 sm:h-[50px] sm:w-32 sm:rounded-2xl"
            />
          ) : (
            <Link
              href={authed ? '/profile' : '/login'}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-btn-1 px-2.5 text-sm font-medium text-text-default transition-colors hover:bg-comp-surface2-hover sm:h-[50px] sm:rounded-2xl sm:pl-6 sm:pr-4"
            >
              <span className="hidden sm:inline">{authed ? t('profile') : t('login')}</span>
              <Icon name={authed ? 'person' : 'login'} size={20} filled={authed} />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
