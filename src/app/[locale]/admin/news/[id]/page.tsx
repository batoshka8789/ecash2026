import { AdminLayout } from '@/components/admin/AdminLayout';
import { NewsEditor } from '@/components/admin/NewsEditor';

export default async function AdminNewsEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AdminLayout>
      <NewsEditor id={id} />
    </AdminLayout>
  );
}
