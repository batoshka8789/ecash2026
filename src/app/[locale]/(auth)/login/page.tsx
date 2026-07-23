import { AuthCard } from '@/components/auth/AuthCard';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-page-bg px-4 py-10">
      <AuthCard initialTab="login" />
    </main>
  );
}
