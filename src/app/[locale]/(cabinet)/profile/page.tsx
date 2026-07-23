import { SidebarLayout } from '@/components/profile/SidebarLayout';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { ProfileForm } from '@/components/profile/ProfileForm';

export default function ProfilePage() {
  return (
    <SidebarLayout>
      <div className="flex flex-col gap-6">
        <ProfileCard />
        <ProfileForm />
      </div>
    </SidebarLayout>
  );
}
