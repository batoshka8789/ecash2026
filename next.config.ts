import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const isProd = process.env.NODE_ENV === 'production';

/**
 * Origin апстрима для connect-src. Берётся из того же ECASH_API_BASE_URL, что и
 * серверный клиент, чтобы при смене dev→прод CSP не пришлось править руками.
 */
const ECASH_API_ORIGIN = new URL(
  process.env.ECASH_API_BASE_URL ?? 'https://api-dev.quiq.kz',
).origin;

/**
 * CSP: 'unsafe-inline' для style-src — требование Tailwind v4 (инлайн-переменные)
 * и next/font; script-src в dev нуждается в 'unsafe-eval' для HMR.
 */
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
  `style-src 'self' 'unsafe-inline'`,
  // OSM-тайлы карты отделений и флаги валют с ecash.kz
  `img-src 'self' data: blob: https://ecash.kz https://tile.openstreetmap.org`,
  `font-src 'self'`,
  // api-dev.quiq.kz — публичные справочники Ecash (отделения, курсы, лучший
  // курс) браузер запрашивает напрямую: их CORS наш origin пускает. Без этой
  // записи CSP рубит запрос раньше сети, и в консоли видно «Failed to fetch»,
  // неотличимое от CORS-отказа. Пользовательские методы сюда не ходят.
  `connect-src 'self' ${ECASH_API_ORIGIN} https://tile.openstreetmap.org${isProd ? '' : ' ws:'}`,
  // MapLibre поднимает воркеры из blob-URL.
  // child-src обязателен рядом с worker-src: Safari worker-src не понимает
  // и откатывается по цепочке child-src → default-src ('self'), из-за чего
  // blob-воркер карты блокировался и карта отделений в Safari не работала.
  `worker-src 'self' blob:`,
  `child-src 'self' blob:`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), payment=(), usb=()' },
  ...(isProd
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: 'standalone',
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      // флаги валют из currImage карточек отделений
      { protocol: 'https', hostname: 'ecash.kz', pathname: '/assets/**' },
    ],
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
