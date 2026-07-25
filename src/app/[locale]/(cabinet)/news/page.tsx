import { NewsList } from '@/components/requests/NewsList';
import { pageMetadata } from '@/lib/metadata';

export default function NewsPage() {
  return <NewsList />;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(locale, 'news', '/news', { noIndex: true });
}
