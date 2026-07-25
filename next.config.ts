import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const isProd = process.env.NODE_ENV === 'production';

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
  `connect-src 'self' https://tile.openstreetmap.org${isProd ? '' : ' ws:'}`,
  // MapLibre поднимает воркеры из blob-URL
  `worker-src 'self' blob:`,
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
