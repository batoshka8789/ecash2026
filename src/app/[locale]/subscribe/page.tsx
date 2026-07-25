import { PageShell } from '@/components/layout/PageShell';
import { SubscribeFlow } from '@/components/flows/SubscribeFlow';
import { SubscriptionsList } from '@/components/flows/SubscriptionsList';
import { pageMetadata } from '@/lib/metadata';

export default function SubscribePage() {
  return (
    <PageShell crumbKey="subscribe">
      <SubscribeFlow />
      <SubscriptionsList />
    </PageShell>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(locale, 'subscribe', '/subscribe');
}
