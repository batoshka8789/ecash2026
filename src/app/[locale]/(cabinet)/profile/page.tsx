import { SidebarLayout } from '@/components/profile/SidebarLayout';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { PasswordCard } from '@/components/profile/PasswordCard';
import { pageMetadata } from '@/lib/metadata';

export default function ProfilePage() {
  return (
    <SidebarLayout>
      <div className="flex flex-col gap-6">
        <ProfileCard />
        <ProfileForm />
        <PasswordCard />
      </div>
    </SidebarLayout>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(locale, 'profile', '/profile', { noIndex: true });
}
