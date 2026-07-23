import { PageShell } from '@/components/layout/PageShell';
import { BookingFlow } from '@/components/flows/BookingFlow';

export default function IndividualRatePage() {
  return (
    <PageShell crumbKey="individual">
      <BookingFlow mode="individual" />
    </PageShell>
  );
}
