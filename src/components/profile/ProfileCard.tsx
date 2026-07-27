'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/lib/auth';
import { formatPhoneInput } from '@/lib/format';

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
  const { account, loading, logout } = useAuth();

  const [busy, setBusy] = useState(false);
  // src, который не смог загрузиться — при смене аватара фоллбэк сбрасывается сам
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const name = [account?.firstName, account?.lastName, account?.middleName]
    .filter(Boolean)
    .join(' ');
  const initials = account
    ? `${account.firstName.charAt(0)}${account.lastName.charAt(0)}`.toUpperCase()
    : '';

  const avatar = account?.profile.avatar ?? null;
  const showAvatar =
    avatar !== null &&
    avatar !== failedSrc &&
    (avatar.startsWith('/') || avatar.startsWith('https://') || avatar.startsWith('http://'));

  const tabs = [
    { icon: 'contact_page', label: t('myData'), href: '/profile' as const },
    { icon: 'location_on', label: t('myAddress'), href: '/profile/address' as const },
  ];

  const onLogout = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await logout();
      // без сессии «/» снова отдаёт лендинг
      router.push('/');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl bg-surface-page-surf1 p-5 sm:rounded-3xl sm:p-8">
      <div className="flex flex-col items-center gap-6">
        {loading ? (
          // скелет повторяет размеры контента — без скачка раскладки
          <>
            <span className="h-[84px] w-[84px] animate-pulse rounded-[25px] bg-surface-page-surf2" />
            <div className="flex flex-col items-center gap-2">
              <span className="h-[22px] w-40 animate-pulse rounded-full bg-surface-page-surf2" />
              <span className="h-[15px] w-28 animate-pulse rounded-full bg-surface-page-surf2" />
            </div>
          </>
        ) : (
          <>
            {showAvatar ? (
              <Image
                src={avatar}
                alt=""
                width={84}
                height={84}
                unoptimized={!avatar.startsWith('/')}
                onError={() => setFailedSrc(avatar)}
                className="h-[84px] w-[84px] rounded-[25px] object-cover"
              />
            ) : (
              <span className="flex h-[84px] w-[84px] items-center justify-center rounded-[25px] bg-brand text-2xl font-bold text-text-always-white">
                {initials || <Icon name="person" size={32} />}
              </span>
            )}

            <div className="flex flex-col items-center gap-2 text-center">
              <div className="text-lg font-bold leading-[1.2] text-text-default">{name}</div>
              <div className="text-sm leading-[1.1] text-text-default">{account?.phoneNumber ? formatPhoneInput(account.phoneNumber) : ''}</div>
            </div>
          </>
        )}

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
            onClick={onLogout}
            disabled={busy}
            className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border border-transparent bg-surface-page-surf2 px-1 py-4 text-center text-xs font-medium text-text-default transition-colors hover:bg-comp-surface2-hover disabled:cursor-default disabled:opacity-60 sm:text-sm"
          >
            <Icon name="logout" size={24} />
            {t('logout')}
          </button>
        </div>
      </div>
    </div>
  );
}
