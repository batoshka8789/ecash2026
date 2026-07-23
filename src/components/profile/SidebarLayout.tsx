'use client';

import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { Link, usePathname } from '@/i18n/navigation';
import { Icon } from '@/components/ui/Icon';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AppBanner } from '@/components/layout/AppBanner';

const items = [
  { key: 'profile', icon: 'person', href: '/profile', match: ['/profile', '/profile/address'] },
  { key: 'notifications', icon: 'notifications', href: '/notifications', match: ['/notifications'] },
  { key: 'news', icon: 'language', href: '/news', match: ['/news'] },
] as const;

/** Раскладка личного кабинета: сайдбар слева + контент. */
export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('sidebar');
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="container-page flex-1 py-8">
        <div className="flex flex-col gap-6 lg:flex-row">
          <aside className="h-fit w-full shrink-0 rounded-3xl bg-surface-page-surf1 p-3 lg:w-56">
            <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
              {items.map((item) => {
                const active = item.match.some((m) => pathname === m);
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={clsx(
                      'flex items-center gap-3 whitespace-nowrap rounded-xl px-4 py-3 text-sm font-medium transition-colors',
                      active
                        ? 'text-text-brand'
                        : 'text-text-default hover:bg-comp-surface1-hover',
                    )}
                  >
                    <Icon name={item.icon} size={20} filled={active} />
                    {t(item.key)}
                  </Link>
                );
              })}
              <Link
                href="/franchise"
                className="flex items-center gap-3 whitespace-nowrap rounded-xl px-4 py-3 text-sm font-medium text-text-default transition-colors hover:bg-comp-surface1-hover"
              >
                <Icon name="diversity_3" size={20} />
                {t('franchise')}
                <Icon name="arrow_outward" size={16} className="ml-auto" />
              </Link>
            </nav>
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
