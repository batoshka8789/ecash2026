import { getTranslations } from 'next-intl/server';
import { PageShell } from '@/components/layout/PageShell';
import { Calculator } from '@/components/sections/Calculator';
import { Branches } from '@/components/sections/Branches';
import { pageMetadata } from '@/lib/metadata';

/** ?view=map — вид «На карте» как URL-состояние: живёт back/reload и шэринг ссылки.
 *  В Next 16 searchParams в пропсах страницы — Promise (чтение делает страницу динамической). */
export default async function LocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const [t, { view }] = await Promise.all([getTranslations('locations'), searchParams]);

  return (
    <PageShell crumbLabel={t('breadcrumbCalc')}>
      <Calculator />
      <Branches initialView={view === 'map' ? 'map' : 'list'} />
    </PageShell>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(locale, 'locations', '/locations');
}
