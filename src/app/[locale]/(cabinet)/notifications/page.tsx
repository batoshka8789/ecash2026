import { SidebarLayout } from '@/components/profile/SidebarLayout';
import { NotificationsCard } from '@/components/profile/NotificationsCard';
import { pageMetadata } from '@/lib/metadata';

export default function NotificationsPage() {
  return (
    <SidebarLayout>
      <NotificationsCard />
    </SidebarLayout>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(locale, 'notifications', '/notifications', { noIndex: true });
}
