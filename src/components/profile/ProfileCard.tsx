'use client';

/* eslint-disable @next/next/no-img-element */

import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/lib/auth';

/**
 * Карточка профиля.
 * Спека макета (1810:160270): col gap24, аватар 84×84 r25.2,
 * имя 18/700 lh21.6 center, телефон 14/400 lh15.4 center,
 * ряд из трёх кнопок row gap4, каждая p16/4 r24 fill #333333,
 * активная — border 1px #F15A25.
 */
export function ProfileCard() {
  const t = useTranslations('profile');
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const name =
    [user?.firstName, user?.middleName].filter(Boolean).join(' ') || user?.email || '';

  const tabs = [
    { icon: 'contact_page', label: t('myData'), href: '/profile' as const },
    { icon: 'location_on', label: t('myAddress'), href: '/profile/address' as const },
  ];

  return (
    <div className="rounded-2xl bg-surface-page-surf1 p-5 sm:rounded-3xl sm:p-8">
      <div className="flex flex-col items-center gap-6">
        {user?.avatar ? (
          <img
            src={user.avatar}
            alt=""
            width={84}
            height={84}
            className="h-[84px] w-[84px] rounded-[25px] object-cover"
          />
        ) : (
          <span className="flex h-[84px] w-[84px] items-center justify-center rounded-[25px] bg-surface-page-surf2 text-text-disabled">
            <Icon name="image" size={32} />
          </span>
        )}

        <div className="flex flex-col items-center gap-2 text-center">
          <div className="text-lg font-bold leading-[1.2] text-text-default">{name}</div>
          <div className="text-sm leading-[1.1] text-text-default">{user?.phone}</div>
        </div>

        <div className="flex w-full gap-1">
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={clsx(
                  'flex flex-1 flex-col items-center justify-center gap-2 rounded-3xl border bg-surface-page-surf2 px-1 py-4 text-center text-xs font-medium transition-colors sm:text-sm',
                  active
                    ? 'border-stroke-brand text-text-brand'
                    : 'border-transparent text-text-default hover:bg-comp-surface2-hover',
                )}
              >
                <Icon name={tab.icon} size={24} filled={active} />
                {tab.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={async () => {
              await logout();
              // без сессии «/» снова отдаёт лендинг
              router.replace('/');
              router.refresh();
            }}
            className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border border-transparent bg-surface-page-surf2 px-1 py-4 text-center text-xs font-medium text-text-default transition-colors hover:bg-comp-surface2-hover sm:text-sm"
          >
            <Icon name="logout" size={24} />
            {t('logout')}
          </button>
        </div>
      </div>
    </div>
  );
}
