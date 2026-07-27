'use client';

import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { Link, usePathname } from '@/i18n/navigation';
import { Icon } from '@/components/ui/Icon';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AppBanner } from '@/components/layout/AppBanner';

/** Раскладка личного кабинета: сайдбар слева + контент. */
export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('sidebar');
  const tNav = useTranslations('nav');
  const pathname = usePathname();

  const items = [
    {
      key: 'profile',
      icon: 'person',
      href: '/profile',
      label: t('profile'),
      match: ['/profile', '/profile/address'],
    },
    {
      key: 'notifications',
      icon: 'notifications',
      href: '/notifications',
      label: t('notifications'),
      match: ['/notifications'],
    },
    { key: 'news', icon: 'language', href: '/news', label: t('news'), match: ['/news'] },
    {
      key: 'requests',
      icon: 'receipt_long',
      href: '/requests',
      label: tNav('requests'),
      match: ['/requests'],
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main" className="container-page flex-1 py-8">
        <div className="flex flex-col gap-3 xl:flex-row xl:gap-[30px]">
          <aside className="relative h-fit w-full shrink-0 rounded-[28px] border border-stroke-surface1 bg-surface-page-surf1 p-4 xl:w-83 xl:p-8">
            <nav
              aria-label={tNav('profile')}
              className="flex snap-x flex-row gap-4 overflow-x-auto xl:flex-col xl:gap-8 xl:overflow-visible"
            >
              {items.map((item) => {
                const active = item.match.some(
                  (m) => pathname === m || pathname.startsWith(`${m}/`),
                );
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={clsx(
                      'flex snap-start items-center gap-2 whitespace-nowrap rounded-[30px] p-2 text-base font-medium leading-5 transition-colors xl:gap-3 xl:rounded-none xl:p-0',
                      active
                        ? 'text-text-brand'
                        : 'text-text-default hover:bg-comp-surface1-hover xl:hover:bg-transparent xl:hover:text-text-brand',
                    )}
                  >
                    <Icon name={item.icon} size={24} filled={active} />
                    {item.label}
                  </Link>
                );
              })}
              <Link
                href="/franchise"
                className="flex snap-start items-center gap-2 whitespace-nowrap rounded-[30px] p-2 text-base font-medium leading-5 text-text-default transition-colors hover:bg-comp-surface1-hover xl:gap-3 xl:rounded-none xl:p-0 xl:hover:bg-transparent xl:hover:text-text-brand"
              >
                <Icon name="diversity_3" size={24} />
                {t('franchise')}
                <Icon name="arrow_outward" size={16} />
              </Link>
            </nav>
            {/* подсказка, что список листается по горизонтали */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 w-10 rounded-r-[28px] bg-gradient-to-l from-surface-page-surf1 to-transparent xl:hidden"
            />
          </aside>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </main>
      <Footer />
      <div className="sticky bottom-0 z-40">
        <AppBanner />
      </div>
    </div>
  );
}
