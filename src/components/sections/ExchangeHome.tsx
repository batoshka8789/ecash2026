import { useTranslations } from 'next-intl';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AppBanner } from '@/components/layout/AppBanner';
import { FirstVisitToast } from '@/components/sections/FirstVisitToast';
import { ActionCards } from '@/components/sections/ActionCards';
import { Calculator } from '@/components/sections/Calculator';
import { RatesList } from '@/components/sections/RatesList';

/** Главная приложения — экран «Main page» макета (1279:104497). */
export function ExchangeHome() {
  const t = useTranslations('nav');

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main" className="flex-1 pb-4">
        {/* визуальный заголовок страницы — калькулятор, h1 только для АТ */}
        <h1 className="sr-only">{t('home')}</h1>
        <FirstVisitToast />
        <ActionCards />
        <Calculator />
        <RatesList />
      </main>
      <Footer />
      <div className="sticky bottom-0 z-40">
        <AppBanner />
      </div>
    </div>
  );
}
