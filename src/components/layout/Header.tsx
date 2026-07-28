'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@/i18n/navigation';
import { Logo } from '@/components/ui/Logo';
import { Icon } from '@/components/ui/Icon';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ThemeToggle } from './ThemeToggle';

/**
 * Шапка — 1:1 по макету (Header 1279:104498): слева логотип, справа тема,
 * уведомления с бейджем, «Войти»/«Профиль». Правый блок ровно 230px:
 * 50 + 8 + 50 + 8 + 114 (237:7823).
 *
 * Навигации в шапке макет не содержит, и это осознанно: роль навигационного
 * хаба играют карточки-действий на главной, хлебные крошки на внутренних
 * страницах и сайдбар кабинета — ссылки на разделы сюда не возвращаем.
 * Переключатель языка тоже не отсюда: в макете его нет ни на одном экране,
 * он вынесен в футер, к строке копирайта.
 *
 * Боковые поля берём из макета, а не из общей колонки контента: 360 на 1920
 * (то есть контент 1200 по центру), 52 на 1024 и 768, 16 на 480 и 360.
 * Отсюда max-w 1304 = 1200 + 2×52.
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
      <div className="mx-auto flex h-[72px] w-full max-w-[1304px] items-center justify-between gap-[30px] px-4 md:h-[82px] md:px-[52px]">
        <Link href="/" aria-label="ecash" className="transition-opacity hover:opacity-80">
          <Logo />
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          <Link
            href="/notifications"
            className="relative inline-flex h-[38px] w-[38px] items-center justify-center rounded-2xl border border-btn-1 bg-btn-1 text-text-default transition-colors hover:border-comp-surface2-hover hover:bg-comp-surface2-hover md:h-[50px] md:w-[50px]"
            aria-label={t('notifications')}
          >
            {/* в макете колокольчик контурный («bell stroke» 847:40147) */}
            <Icon name="notifications" size={20} />
            {/* подпись бейджа в макете — Inter Semi Bold 14/14 (531:13710) */}
            {authed && typeof unread === 'number' && unread > 0 && (
              <span className="absolute -right-[3px] -top-2 flex h-[19px] min-w-6 items-center justify-center rounded-xl bg-positive px-2 font-inter text-sm font-semibold leading-none text-text-always-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Link>

          {loading ? (
            // пока сессия загружается — нейтральная заглушка вместо мигания «Войти»
            <span
              aria-hidden
              className="inline-flex h-[38px] w-[38px] animate-pulse rounded-2xl bg-btn-1 md:h-[50px] md:w-[114px]"
            />
          ) : (
            <Link
              href={authed ? '/profile' : '/login'}
              className="inline-flex h-[38px] w-[38px] items-center justify-center gap-2 rounded-2xl border border-btn-1 bg-btn-1 text-sm font-medium leading-5 text-text-default transition-colors hover:border-comp-surface2-hover hover:bg-comp-surface2-hover md:h-[50px] md:w-auto md:justify-start md:pl-6 md:pr-4"
            >
              <span className="hidden md:inline">{authed ? t('profile') : t('login')}</span>
              {/* слот иконки в макете 24×24 при глифе 20 («Icon wrapper» 847:36891):
                  из него складывается ширина кнопки 114 = 1+24+40+8+24+16+1 */}
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center">
                <Icon name={authed ? 'person' : 'login'} size={20} filled={authed} />
              </span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
