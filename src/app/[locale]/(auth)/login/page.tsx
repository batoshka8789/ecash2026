import { AuthCard } from '@/components/auth/AuthCard';
import { pageMetadata } from '@/lib/metadata';

export default function LoginPage() {
  return (
    /* На 360 модалка макета занимает экран целиком, поэтому полей у страницы нет */
    <main
      id="main"
      className="flex min-h-screen items-center justify-center bg-surface-page-bg px-4 py-10 max-[361px]:p-0"
    >
      <AuthCard initialTab="login" />
    </main>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(locale, 'login', '/login', { noIndex: true });
}
