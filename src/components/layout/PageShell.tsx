import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AppBanner } from '@/components/layout/AppBanner';
import { Icon } from '@/components/ui/Icon';

/**
 * Обёртка внутренних страниц: шапка + хлебные крошки + футер + баннер.
 * Крошку задаёт либо crumbKey (ключ из namespace `crumbs`), либо
 * готовая строка crumbLabel — для страниц, чей заголовок живёт
 * в другом namespace (например, /locations).
 */
export function PageShell({
  crumbKey,
  crumbLabel,
  children,
}: {
  crumbKey?: string;
  crumbLabel?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations('crumbs');
  const label = crumbLabel ?? (crumbKey ? t(crumbKey) : '');

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main" className="flex-1 pb-4">
        <nav aria-label="Breadcrumb" className="container-page pt-6 text-base font-medium">
          <ol className="flex items-center gap-3">
            <li>
              <Link
                href="/"
                className="block py-3 leading-5 text-text-disabled transition-colors hover:text-text-default"
              >
                {t('home')}
              </Link>
            </li>
            <li className="flex items-center gap-3">
              <Icon name="chevron_right" size={16} className="text-text-disabled" />
              <span
                aria-current="page"
                className="block border-b-2 border-brand py-3 leading-5 text-text-default"
              >
                {label}
              </span>
            </li>
          </ol>
        </nav>
        {children}
      </main>
      <Footer />
      <div className="sticky bottom-0 z-40">
        <AppBanner />
      </div>
    </div>
  );
}
