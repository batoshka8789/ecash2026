import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { isAuthenticated, sessionIsAdmin } from '@/server/session';

/**
 * Гость → на вход, как в кабинете. Залогиненный не-админ → 404: раздел для
 * него просто не существует, подтверждать его наличие незачем.
 *
 * Роль здесь берётся из зашифрованной куки, без похода в сеть: Server
 * Component не может ротировать токен. Это только чтобы не рисовать экран —
 * авторитетная проверка живёт в withAdmin на каждом запросе к API.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAuthenticated())) {
    redirect({ href: '/login', locale: await getLocale() });
  }
  if (!(await sessionIsAdmin())) notFound();
  return children;
}

export const metadata = {
  title: 'Редакция — ecash',
  robots: { index: false, follow: false },
};
