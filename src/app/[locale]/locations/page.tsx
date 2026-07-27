import { getTranslations } from 'next-intl/server';
import { PageShell } from '@/components/layout/PageShell';
import { Calculator } from '@/components/sections/Calculator';
import { Branches } from '@/components/sections/Branches';
import { pageMetadata } from '@/lib/metadata';

/** ?view=map — вид «На карте» как URL-состояние: живёт back/reload и шэринг ссылки.
 *  ?currency= — валюта строки курсов, из которой пришли («на карте» у строки):
 *  калькулятор наверху обязан открыться с ней, а не с USD по умолчанию.
 *  В Next 16 searchParams в пропсах страницы — Promise (чтение делает страницу динамической). */
export default async function LocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[]; currency?: string | string[] }>;
}) {
  const [t, { view, currency }] = await Promise.all([getTranslations('locations'), searchParams]);
  // нормализация: URL могут набрать руками (?currency=usd) — коды в API
  // в верхнем регистре; мусор, не похожий на код валюты, отбрасываем
  const initialCurrency =
    typeof currency === 'string' && /^[a-z0-9]{1,8}$/i.test(currency)
      ? currency.toUpperCase()
      : undefined;

  return (
    <PageShell crumbLabel={t('breadcrumbCalc')}>
      <Calculator initialCurrency={initialCurrency} syncCurrencyToUrl />
      <Branches initialView={view === 'map' ? 'map' : 'list'} />
    </PageShell>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(locale, 'locations', '/locations');
}
