import { SidebarLayout } from '@/components/profile/SidebarLayout';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { AddressCard } from '@/components/profile/AddressCard';
import { pageMetadata } from '@/lib/metadata';

export default function ProfileAddressPage() {
  return (
    <SidebarLayout>
      <div className="flex flex-col gap-1">
        <ProfileCard />
        <AddressCard />
      </div>
    </SidebarLayout>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(locale, 'profile', '/profile/address', { noIndex: true });
}
