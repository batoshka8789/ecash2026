import { AuthCard } from '@/components/auth/AuthCard';
import { pageMetadata } from '@/lib/metadata';

export default function LoginPage() {
  return (
    <main id="main" className="flex min-h-screen items-center justify-center bg-surface-page-bg px-4 py-10">
      <AuthCard initialTab="login" />
    </main>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(locale, 'login', '/login', { noIndex: true });
}
