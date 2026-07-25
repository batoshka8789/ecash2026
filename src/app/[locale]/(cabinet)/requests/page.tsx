import { RequestsList } from '@/components/requests/RequestsList';
import { pageMetadata } from '@/lib/metadata';

export default function RequestsPage() {
  return <RequestsList />;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(locale, 'requests', '/requests', { noIndex: true });
}
