'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/lib/auth';

/** «+7 (777) 019 63 44» — маска телефона из макета [1810:153571]. */
function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  // 11 цифр с ведущей 7/8 либо 10 без кода страны — иначе показываем как есть
  const n = d.length === 11 && (d[0] === '7' || d[0] === '8') ? d.slice(1) : d;
  if (n.length !== 10) return phone;
  return `+7 (${n.slice(0, 3)}) ${n.slice(3, 6)} ${n.slice(6, 8)} ${n.slice(8)}`;
}

/**
 * Карточка профиля.
 * Спека макета («Frame 1437255280» [1810:153566] 838×329): padding 32 (16 по
 * бокам и снизу на ≤480), col gap24, аватар 84×84 r25.2, имя 18/700 lh21.6
 * center, телефон 14/400 lh15.4 center, ряд из трёх кнопок row gap4, каждая
 * p16/4 r24 fill #333333, активная — border 1px #F15A25.
 * Ниже xl карточка идёт в край экрана, поэтому верхние углы не скруглены
 * (radius 0 0 28 28).
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
    <div className="rounded-[28px] border border-stroke-surface1 bg-surface-page-surf1 px-4 pb-4 pt-8 max-xl:rounded-t-none md:p-8">
      <div className="flex flex-col items-center gap-6">
        {loading ? (
          // скелет повторяет размеры контента — без скачка раскладки
          <>
            <span className="h-[84px] w-[84px] animate-pulse rounded-[25.2px] bg-surface-page-surf2" />
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
                className="h-[84px] w-[84px] rounded-[25.2px] object-cover"
              />
            ) : (
              /* пустой аватар — подложка #333333 и иконка загрузки 36 [1810:161100] */
              <span className="flex h-[84px] w-[84px] items-center justify-center rounded-[25.2px] bg-surface-page-surf2 text-text-default">
                <Icon name="add_photo_alternate" size={36} filled />
              </span>
            )}

            <div className="flex flex-col items-center gap-2 text-center">
              <div className="text-lg font-bold leading-[1.2] text-text-default">{name}</div>
              <div className="text-sm leading-[1.1] text-text-default">
                {account?.phoneNumber ? formatPhone(account.phoneNumber) : ''}
              </div>
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
                  'flex flex-1 flex-col items-center justify-center gap-2 rounded-3xl border bg-surface-page-surf2 px-1 py-4 text-center text-sm font-medium leading-5 transition-colors',
                  active
                    ? 'border-stroke-brand text-text-brand'
                    : 'border-stroke-surface1 text-text-default hover:bg-comp-surface2-hover',
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
            className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border border-stroke-surface1 bg-surface-page-surf2 px-1 py-4 text-center text-sm font-medium leading-5 text-text-default transition-colors hover:bg-comp-surface2-hover disabled:cursor-default disabled:opacity-60"
          >
            <Icon name="logout" size={24} />
            {t('logout')}
          </button>
        </div>
      </div>
    </div>
  );
}
