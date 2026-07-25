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
        <div className="flex flex-col gap-6 lg:flex-row">
          <aside className="relative h-fit w-full shrink-0 rounded-3xl bg-surface-page-surf1 p-3 lg:w-64">
            <nav
              aria-label={tNav('profile')}
              className="flex snap-x flex-row gap-1 overflow-x-auto lg:flex-col lg:overflow-visible"
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
                      'flex snap-start items-center gap-3 whitespace-nowrap rounded-xl px-4 py-3 text-sm font-medium transition-colors',
                      active
                        ? 'text-text-brand'
                        : 'text-text-default hover:bg-comp-surface1-hover',
                    )}
                  >
                    <Icon name={item.icon} size={20} filled={active} />
                    {item.label}
                  </Link>
                );
              })}
              <Link
                href="/franchise"
                className="flex snap-start items-center gap-3 whitespace-nowrap rounded-xl px-4 py-3 text-sm font-medium text-text-default transition-colors hover:bg-comp-surface1-hover"
              >
                <Icon name="diversity_3" size={20} />
                {t('franchise')}
                <Icon name="arrow_outward" size={16} className="ml-auto" />
              </Link>
            </nav>
            {/* подсказка, что список листается по горизонтали */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 w-10 rounded-r-3xl bg-gradient-to-l from-surface-page-surf1 to-transparent lg:hidden"
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
