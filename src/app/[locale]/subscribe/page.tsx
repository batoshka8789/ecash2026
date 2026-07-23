import { PageShell } from '@/components/layout/PageShell';
import { SubscribeFlow } from '@/components/flows/SubscribeFlow';

export default function SubscribePage() {
  return (
    <PageShell crumbKey="subscribe">
      <SubscribeFlow />
    </PageShell>
  );
}
