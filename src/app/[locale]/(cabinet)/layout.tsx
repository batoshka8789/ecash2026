import { redirect } from '@/i18n/navigation';
import { getLocale } from 'next-intl/server';
import { isAuthenticated } from '@/server/session';

/**
 * Личный кабинет доступен только по сессии.
 * Гостя отправляем на вход — проверка на сервере, до отрисовки,
 * поэтому защищённый контент не мелькает.
 */
export default async function CabinetLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAuthenticated())) {
    const locale = await getLocale();
    redirect({ href: '/login', locale });
  }
  return children;
}
