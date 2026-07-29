import { AdminLayout } from '@/components/admin/AdminLayout';
import { NewsLibrary } from '@/components/admin/NewsLibrary';

export default function AdminNewsPage() {
  return (
    <AdminLayout>
      <NewsLibrary />
    </AdminLayout>
  );
}
