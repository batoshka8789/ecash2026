import { RecoveryFlow } from '@/components/auth/RecoveryFlow';
import { pageMetadata } from '@/lib/metadata';

export default function RecoveryPage() {
  return (
    <main
      id="main"
      className="flex min-h-screen items-center justify-center bg-surface-page-bg px-4 py-10"
    >
      <RecoveryFlow />
    </main>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(locale, 'recovery', '/recovery', { noIndex: true });
}
