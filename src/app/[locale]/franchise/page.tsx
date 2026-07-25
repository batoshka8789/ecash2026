import { Landing } from '@/components/landing/Landing';
import { pageMetadata } from '@/lib/metadata';

/** Лендинг франшизы — секция «landing / franch» из макета. */
export default function FranchisePage() {
  return <Landing />;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(locale, 'franchise', '/franchise');
}
