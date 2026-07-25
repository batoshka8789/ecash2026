import { PageShell } from '@/components/layout/PageShell';
import { BookingFlow } from '@/components/flows/BookingFlow';
import { pageMetadata } from '@/lib/metadata';

export default function IndividualRatePage() {
  return (
    <PageShell crumbKey="individual">
      <BookingFlow mode="individual" />
    </PageShell>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(locale, 'individualRate', '/individual-rate');
}
