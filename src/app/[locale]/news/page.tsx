import { NewsList } from '@/components/news/NewsList';
import { NewsShell } from '@/components/news/NewsShell';
import { pageMetadata } from '@/lib/metadata';

export default function NewsPage() {
  return (
    <NewsShell>
      <NewsList />
    </NewsShell>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // новости стали публичными — индексацию больше не запрещаем
  return pageMetadata(locale, 'news', '/news');
}
