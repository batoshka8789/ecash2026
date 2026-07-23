import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // всё, кроме статики, api и файлов с расширением
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
};
