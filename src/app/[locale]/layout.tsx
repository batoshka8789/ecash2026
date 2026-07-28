import type { Metadata } from 'next';
import { Roboto, Inter, Rubik } from 'next/font/google';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { AuthProvider } from '@/lib/auth';
import { RealtimeProvider } from '@/lib/realtime';
import { SkipLink } from '@/components/layout/SkipLink';
// material-symbols и flag-icons подключены внутри globals.css в слое vendor —
// отсюда их импортировать нельзя, иначе они снова окажутся вне слоёв
// и перебьют утилиты Tailwind (см. комментарий в globals.css).
import '../globals.css';

const roboto = Roboto({
  variable: '--font-roboto',
  subsets: ['latin', 'cyrillic'],
  // 600 в макете несёт всю акцентную типографику (заголовки карточек 28px,
  // суммы и подписи 16px). Без него браузер подставлял ближайший сверху — 700.
  weight: ['400', '500', '600', '700'],
});

/**
 * Макет верстает интерфейс не одним Roboto: Inter несёт курсы, подписи
 * колонок, плейсхолдеры полей и хлебные крошки, Rubik Medium 20/1.4 —
 * коды валют (USD, EUR, GOLD, Bitcoin) единообразно на всех брейкпоинтах.
 * Полная шкала из 41 сочетания — design/raw/spec/typescale.txt.
 */
// Суффикс -src обязателен: ключи темы Tailwind называются --font-inter /
// --font-rubik, и если next/font объявит переменные теми же именами,
// значение сошлётся само на себя.
const inter = Inter({
  variable: '--font-inter-src',
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
});

const rubik = Rubik({
  variable: '--font-rubik-src',
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500'],
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
      className={`${roboto.variable} ${inter.variable} ${rubik.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <NextIntlClientProvider>
          <SkipLink />
          <AuthProvider>
            <RealtimeProvider>{children}</RealtimeProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
