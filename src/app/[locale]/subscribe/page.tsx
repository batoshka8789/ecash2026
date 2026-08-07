import { PageShell } from '@/components/layout/PageShell';
import { SubscribeFlow } from '@/components/flows/SubscribeFlow';
import { SubscriptionsList } from '@/components/flows/SubscriptionsList';
import { PushCard } from '@/components/profile/PushCard';
import { pageMetadata } from '@/lib/metadata';

export default function SubscribePage() {
  return (
    <PageShell crumbKey="subscribe">
      <SubscribeFlow />
      {/* сразу под формой: подписку только что завели — самое время
          разрешить браузеру о ней сообщить */}
      <div className="container-page bleed-mobile pt-1">
        <PushCard />
      </div>
      <SubscriptionsList />
    </PageShell>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(locale, 'subscribe', '/subscribe');
}
