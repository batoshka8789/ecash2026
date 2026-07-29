import { AdminLayout } from '@/components/admin/AdminLayout';
import { NewsEditor } from '@/components/admin/NewsEditor';

export default function AdminNewsCreatePage() {
  return (
    <AdminLayout>
      <NewsEditor />
    </AdminLayout>
  );
}
