'use client';

import { SidebarLayout } from '@/components/profile/SidebarLayout';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AppBanner } from '@/components/layout/AppBanner';
import { useAuth } from '@/lib/auth';

/**
 * Новости стали публичными, но остались пунктом кабинета. Поэтому вошедшему
 * показываем привычную раскладку с сайдбаром (ничего не поменялось), а гостю —
 * обычную страницу: вкладки «Мои заявки» и «Уведомления» вели бы его на вход.
 *
 * Пока сессия грузится, рисуем гостевой вариант: он безопаснее — сайдбар
 * появится сам, а не мигнёт лишними пунктами у неавторизованного.
 */
export function NewsShell({ children }: { children: React.ReactNode }) {
  const { authed } = useAuth();

  if (authed) return <SidebarLayout>{children}</SidebarLayout>;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main" className="container-page flex-1 py-8">
        {children}
      </main>
      <Footer />
      <div className="sticky bottom-0 z-40">
        <AppBanner />
      </div>
    </div>
  );
}
