import { PageShell } from '@/components/layout/PageShell';
import { BookingFlow } from '@/components/flows/BookingFlow';

export default function BookingPage() {
  return (
    <PageShell crumbKey="booking">
      <BookingFlow mode="booking" />
    </PageShell>
  );
}
