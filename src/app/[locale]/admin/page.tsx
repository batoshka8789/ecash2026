import { redirect } from '@/i18n/navigation';
import { getLocale } from 'next-intl/server';

export default async function AdminIndexPage() {
  redirect({ href: '/admin/news', locale: await getLocale() });
}
