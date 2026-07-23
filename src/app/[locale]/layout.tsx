import type { Metadata } from 'next';
import { Roboto } from 'next/font/google';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { AuthProvider } from '@/lib/auth';
import 'material-symbols/rounded.css';
import 'flag-icons/css/flag-icons.min.css';
import '../globals.css';

const roboto = Roboto({
  variable: '--font-roboto',
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '700'],
});

export const metadata: Metadata = {
  title: 'ecash — обмен валют',
  description: 'Курсы валют, бронирование и обменники рядом с вами',
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  // тема приходит из cookie и рендерится сервером — без мигания при загрузке
  const theme = (await cookies()).get('theme')?.value;

  return (
    <html
      lang={locale}
      data-theme={theme === 'light' ? 'light' : undefined}
      className={`${roboto.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <NextIntlClientProvider>
          <AuthProvider>{children}</AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
