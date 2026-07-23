import { currentUser } from '@/server/session';
import { Landing } from '@/components/landing/Landing';
import { ExchangeHome } from '@/components/sections/ExchangeHome';

/**
 * Точка входа.
 *
 * Гость видит лендинг франшизы — это витрина продукта.
 * Авторизованный сразу попадает в приложение (курсы, калькулятор, отделения).
 * Адрес один и тот же, поэтому нет ни редиректа, ни мигания при загрузке;
 * решение принимается на сервере по сессионной куке.
 */
export default async function IndexPage() {
  const user = await currentUser();
  return user ? <ExchangeHome /> : <Landing />;
}
