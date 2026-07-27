import { ExchangeHome } from '@/components/sections/ExchangeHome';
import { pageMetadata } from '@/lib/metadata';

/**
 * Точка входа — «Main page» из макета, доступна всем без авторизации:
 * курсы и калькулятор — это витрина продукта, ради которой приходят.
 * Лендинг франшизы живёт отдельно на /franchise; конкретные действия
 * (бронь, подписка) сами просят войти при попытке отправить форму.
 */
export default function IndexPage() {
  return <ExchangeHome />;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(locale, 'home', '');
}
