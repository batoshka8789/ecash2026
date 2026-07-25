import { isAuthenticated } from '@/server/session';
import { Landing } from '@/components/landing/Landing';
import { ExchangeHome } from '@/components/sections/ExchangeHome';
import { pageMetadata } from '@/lib/metadata';

/**
 * Точка входа.
 *
 * Гость видит лендинг франшизы — это витрина продукта.
 * Авторизованный сразу попадает в приложение (курсы, калькулятор, отделения).
 * Адрес один и тот же, поэтому нет ни редиректа, ни мигания при загрузке;
 * решение принимается на сервере по сессионной куке — без обращений к сети.
 */
export default async function IndexPage() {
  return (await isAuthenticated()) ? <ExchangeHome /> : <Landing />;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(locale, 'home', '');
}
