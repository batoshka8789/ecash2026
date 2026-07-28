import { PageShell } from '@/components/layout/PageShell';
import { SubscribeFlow } from '@/components/flows/SubscribeFlow';
import { pageMetadata } from '@/lib/metadata';

export default function SubscribePage() {
  return (
    // Макет 1774:157050 держит на роуте ровно две карточки формы: блока
    // «Мои подписки» (SubscriptionsList) нет ни на одном из пяти
    // брейкпоинтов, его место — в разделе заявок кабинета.
    <PageShell crumbKey="subscribe">
      <SubscribeFlow />
    </PageShell>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(locale, 'subscribe', '/subscribe');
}
