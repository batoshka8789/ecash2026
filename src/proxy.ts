import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const intl = createMiddleware(routing);

/** Имя сессионной куки — дублирует src/server/session.ts (edge не тянет server-only). */
const SESSION_COOKIE = 'ecash_s';

/** Кабинетные пути (без префикса локали). */
const PROTECTED = /^\/(profile|notifications|news|requests)(\/|$)/;
/** Страницы входа (без префикса локали). */
const AUTH_PAGES = /^\/(login|signup|recovery)(\/|$)/;

/** Срезает префикс локали: /en/profile → /profile. */
function stripLocale(pathname: string): string {
  const m = pathname.match(/^\/(en|kk)(\/.*|$)/);
  return m ? m[2] || '/' : pathname;
}

/**
 * Поверх i18n-мидлвары — быстрые серверные редиректы по наличию куки:
 * гость в кабинете → /login (иначе redirect() из layout стримится как
 * 200 + meta-refresh с секундой белой страницы); авторизованный на
 * страницах входа → на главную. Валидность куки проверяет сервер —
 * здесь только наличие, этого достаточно для UX-редиректа.
 */
export default function proxy(req: NextRequest) {
  const path = stripLocale(req.nextUrl.pathname);
  const hasSession = req.cookies.has(SESSION_COOKIE);

  if (!hasSession && PROTECTED.test(path)) {
    const url = req.nextUrl.clone();
    url.pathname = req.nextUrl.pathname.replace(path, '/login');
    url.search = '';
    return NextResponse.redirect(url, 307);
  }

  if (hasSession && AUTH_PAGES.test(path)) {
    const url = req.nextUrl.clone();
    url.pathname = req.nextUrl.pathname.replace(path, '/');
    url.search = '';
    return NextResponse.redirect(url, 307);
  }

  return intl(req);
}

export const config = {
  // всё, кроме статики, api и файлов с расширением
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
};
