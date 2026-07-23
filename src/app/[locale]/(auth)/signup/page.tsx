import { AuthCard } from '@/components/auth/AuthCard';

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-page-bg px-4 py-10">
      <AuthCard initialTab="signup" />
    </main>
  );
}
