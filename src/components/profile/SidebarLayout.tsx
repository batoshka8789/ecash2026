'use client';

import { useTranslations } from 'next-intl';
import { clsx } from 'clsx';
import { Link, usePathname } from '@/i18n/navigation';
import { Icon } from '@/components/ui/Icon';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AppBanner } from '@/components/layout/AppBanner';

/**
 * Раскладка личного кабинета.
 *
 * ≥xl — сайдбар «side bar» [1810:170391] 332×256 слева (col gap 32, padding 32,
 * r28) и колонка контента 838 через зазор 30.
 * Ниже xl сайдбар превращается в полосу «tab bar» [1810:152557] во всю ширину
 * вьюпорта сразу под шапкой: высота 68 (пункты 36 + padding 16), боковые поля
 * 52 на 768/1024 и 16 на 360/480, только нижняя граница, без радиуса.
 * Карточки контента ниже xl тоже идут в край экрана, поэтому боковых полей у
 * <main> там нет — их несёт собственный padding карточек.
 */
export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('sidebar');
  const tNav = useTranslations('nav');
  const pathname = usePathname();

  // В макете ровно три пункта + ссылка на франшизу — «Мои заявки» там нет.
  const items = [
    {
      key: 'profile',
      icon: 'person',
      href: '/profile' as const,
      label: t('profile'),
      match: ['/profile', '/profile/address'],
    },
    {
      key: 'notifications',
      icon: 'notifications',
      href: '/notifications' as const,
      label: t('notifications'),
      match: ['/notifications'],
    },
    {
      key: 'news',
      icon: 'language',
      href: '/news' as const,
      label: t('news'),
      match: ['/news'],
    },
  ];

  const isActive = (match: string[]) =>
    match.some((m) => pathname === m || pathname.startsWith(`${m}/`));

  /** Пункт «Открыть франшизу»: ниже xl текст 14/400 lh15.4 и иконка 20 [1774:154641]. */
  const franchise = (compact: boolean) => (
    <Link
      href="/franchise"
      className={clsx(
        'flex shrink-0 snap-start items-center gap-2 whitespace-nowrap rounded-[30px] text-text-default transition-colors',
        compact
          ? 'h-9 px-2 text-sm font-normal leading-[1.1] hover:bg-comp-surface1-hover'
          : 'gap-3 text-base font-medium leading-5 hover:text-text-brand',
      )}
    >
      <Icon name="diversity_3" size={compact ? 20 : 24} />
      {t('franchise')}
      <Icon name="arrow_outward" size={16} />
    </Link>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main" className="flex-1 xl:container-page xl:py-8">
        {/* Ниже xl — полоса навигации во всю ширину, вплотную к шапке */}
        <nav
          aria-label={tNav('profile')}
          className="flex h-[68px] snap-x scroll-pl-4 items-center gap-4 overflow-x-auto border-b border-stroke-surface1 bg-surface-page-surf1 px-4 md:scroll-pl-13 md:px-13 xl:hidden"
        >
          {items.map((item) => {
            const active = isActive(item.match);
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'flex h-9 shrink-0 snap-start items-center gap-2 whitespace-nowrap rounded-[30px] px-2 text-base font-medium leading-5 transition-colors',
                  active ? 'text-text-brand' : 'text-text-default hover:bg-comp-surface1-hover',
                )}
              >
                <Icon name={item.icon} size={24} filled={active} />
                {item.label}
              </Link>
            );
          })}
          {franchise(true)}
        </nav>

        <div className="mt-3 xl:mt-0 xl:flex xl:gap-[30px]">
          <aside className="hidden h-fit w-83 shrink-0 rounded-[28px] border border-stroke-surface1 bg-surface-page-surf1 p-8 xl:block">
            <nav aria-label={tNav('profile')} className="flex flex-col gap-8">
              {items.map((item) => {
                const active = isActive(item.match);
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={clsx(
                      'flex items-center gap-3 whitespace-nowrap text-base font-medium leading-5 transition-colors',
                      active ? 'text-text-brand' : 'text-text-default hover:text-text-brand',
                    )}
                  >
                    <Icon name={item.icon} size={24} filled={active} />
                    {item.label}
                  </Link>
                );
              })}
              {franchise(false)}
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
