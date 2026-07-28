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
      {/* relative — база для тоста первого визита: ниже 768 он лежит поверх контента */}
      <main id="main" className="relative flex-1 pb-4">
        {/* визуальный заголовок страницы — калькулятор, h1 только для АТ */}
        <h1 className="sr-only">{t('home')}</h1>
        <FirstVisitToast />
        <ActionCards />
        <Calculator />
        <RatesList />
      </main>
      <Footer />
      {/*
       * Баннер в макете прижат к низу фрейма (vConstraint=MAX) и накладывается
       * на хвост футера, собственной высоты документу не добавляя: высота всех
       * пяти фреймов равна низу футера. Поэтому fixed, а не sticky в потоке —
       * иначе под футером оставалась пустая полоса в высоту баннера (94 на
       * 1920/1024, 158 на 768/480, 204 на 360).
       */}
      <div className="fixed inset-x-0 bottom-0 z-40">
        <AppBanner />
      </div>
    </div>
  );
}
