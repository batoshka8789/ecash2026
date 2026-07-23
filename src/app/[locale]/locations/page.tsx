import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AppBanner } from '@/components/layout/AppBanner';
import { Calculator } from '@/components/sections/Calculator';
import { Branches } from '@/components/sections/Branches';
import { Icon } from '@/components/ui/Icon';

export default function LocationsPage() {
  const t = useTranslations('locations');

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 pb-4">
        <nav className="container-page flex items-center gap-2 pt-6 text-sm">
          <Link href="/" className="text-text-disabled transition-colors hover:text-text-default">
            {t('breadcrumbHome')}
          </Link>
          <Icon name="chevron_right" size={16} className="text-text-disabled" />
          <span className="border-b-2 border-brand pb-0.5 text-text-default">
            {t('breadcrumbCalc')}
          </span>
        </nav>
        <Calculator />
        <Branches />
      </main>
      <Footer />
      <div className="sticky bottom-0 z-40">
        <AppBanner />
      </div>
    </div>
  );
}
