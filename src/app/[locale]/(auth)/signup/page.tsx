import { AuthCard } from '@/components/auth/AuthCard';
import { pageMetadata } from '@/lib/metadata';

export default function SignupPage() {
  return (
    <main id="main" className="flex min-h-screen items-center justify-center bg-surface-page-bg px-4 py-10">
      <AuthCard initialTab="signup" />
    </main>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(locale, 'signup', '/signup', { noIndex: true });
}
