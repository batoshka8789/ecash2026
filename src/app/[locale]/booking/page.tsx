import { PageShell } from '@/components/layout/PageShell';
import { BookingFlow } from '@/components/flows/BookingFlow';
import { pageMetadata } from '@/lib/metadata';

export default function BookingPage() {
  return (
    <PageShell crumbKey="booking">
      <BookingFlow mode="booking" />
    </PageShell>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(locale, 'booking', '/booking');
}
