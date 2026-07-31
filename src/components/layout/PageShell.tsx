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
        {/*
         * Крошки «Navs, bread crumbs» (363:27570). Зазор от низа шапки в макете
         * везде 12: y=95 при шапке 83 (≥768) и y=85 при шапке 73 (≤480) —
         * отсюда pt-3, а не pt-6.
         *
         * Строка ровно 44 с 768 и 40 ниже: пункт — padding 12 сверху и снизу
         * вокруг строки 20 (≥768) или 16 (≤480). Подчёркивание активного пункта
         * в макете лежит ВНУТРИ блока, поэтому border-bottom забирает 2px
         * у нижнего паддинга, а не добавляет.
         *
         * Начертания: «Главная» — Inter Medium 16/20 на всех ширинах,
         * активный пункт — тот же Inter Medium с 768 и Roboto Regular 16 ниже.
         */}
        <nav aria-label="Breadcrumb" className="container-page pt-3 text-base">
          <ol className="flex items-center gap-3">
            <li>
              <Link
                href="/"
                className="block py-3 font-inter font-medium leading-4 text-text-disabled transition-colors hover:text-text-default md:leading-5"
              >
                {t('home')}
              </Link>
            </li>
            <li className="flex items-center gap-3">
              <Icon name="chevron_right" size={16} className="text-text-disabled" />
              <span
                aria-current="page"
                className="block border-b-2 border-brand pb-[10px] pt-3 leading-4 text-text-default md:font-inter md:font-medium md:leading-5"
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
