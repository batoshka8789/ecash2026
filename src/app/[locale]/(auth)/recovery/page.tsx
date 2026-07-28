import { RecoveryFlow } from '@/components/auth/RecoveryFlow';
import { pageMetadata } from '@/lib/metadata';

export default function RecoveryPage() {
  return (
    /* На 360 модалка макета занимает экран целиком, поэтому полей у страницы нет */
    <main
      id="main"
      className="flex min-h-screen items-center justify-center bg-surface-page-bg px-4 py-10 max-[361px]:p-0"
    >
      <RecoveryFlow />
    </main>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(locale, 'recovery', '/recovery', { noIndex: true });
}
