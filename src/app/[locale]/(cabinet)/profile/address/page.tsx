import { SidebarLayout } from '@/components/profile/SidebarLayout';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { AddressCard } from '@/components/profile/AddressCard';

export default function ProfileAddressPage() {
  return (
    <SidebarLayout>
      <div className="flex flex-col gap-6">
        <ProfileCard />
        <AddressCard />
      </div>
    </SidebarLayout>
  );
}
