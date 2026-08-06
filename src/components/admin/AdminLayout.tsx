'use client';

import { clsx } from 'clsx';
import { Link, usePathname } from '@/i18n/navigation';
import { Icon } from '@/components/ui/Icon';
import { Header } from '@/components/layout/Header';
import { useAdminStrings } from './strings';

/**
 * Раскладка редакции — тот же рисунок, что у кабинета
 * (components/profile/SidebarLayout), но со своим набором пунктов и без
 * нижнего баннера приложения: он прибит к низу экрана и на мобильном
 * перекрывал бы панель сохранения.
 */
export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useAdminStrings();

  const items = [
    { key: 'news', icon: 'newspaper', href: '/admin/news' as const, label: t.news },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      {/* шире, чем container-page: редакция — рабочий инструмент, здесь рядом
          стоят редактор и превью, и на 1232 px обоим было тесно */}
      <main id="main" className="mx-auto w-full max-w-[1680px] flex-1 px-4 py-8">
        <div className="flex flex-col gap-6 lg:flex-row">
          <aside className="relative h-fit w-full shrink-0 rounded-3xl bg-surface-page-surf1 p-3 lg:w-64">
            <div className="mb-2 flex items-center gap-2 px-4 pt-2">
              <span className="rounded-full bg-brand-hardsoft px-3 py-1 text-xs font-medium text-text-brand">
                {t.section}
              </span>
            </div>
            <nav
              aria-label={t.section}
              className="flex snap-x flex-row gap-1 overflow-x-auto lg:flex-col lg:overflow-visible"
            >
              {items.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    prefetch={false}
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
                href="/profile"
                prefetch={false}
                className="flex snap-start items-center gap-3 whitespace-nowrap rounded-xl px-4 py-3 text-sm font-medium text-text-default transition-colors hover:bg-comp-surface1-hover"
              >
                <Icon name="arrow_back" size={20} />
                {t.toCabinet}
              </Link>
            </nav>
          </aside>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </main>
    </div>
  );
}
