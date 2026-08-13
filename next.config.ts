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
  // mapgl.2gis.com — загрузчик @2gis/mapgl инжектит его скриптом на лету;
  // api-maps.yandex.ru — второй провайдер карты отделений (BranchMap умеет
  // переключаться между обоими, см. map-drivers/); yastatic.net — CDN, с
  // которого api-maps.yandex.ru сам подгружает свой основной бандл
  // (full.js) уже ПОСЛЕ инициализации — без него скрипт грузится, но сама
  // карта падает с «Failed to bundle "full"», проверено вживую. Домен нужен
  // ДВАЖДЫ — голый apex (реальный src бандла) и *.yastatic.net (поддомены
  // статики) — `*.` в CSP матчит только поддомены, apex сам по себе нет.
  `script-src 'self' 'unsafe-inline' https://mapgl.2gis.com https://api-maps.yandex.ru https://yastatic.net https://*.yastatic.net${isProd ? '' : " 'unsafe-eval'"}`,
  `style-src 'self' 'unsafe-inline'`,
  // Тайлы, иконки и шрифты карты расползаются по поддоменам провайдеров
  // (2GIS: mapgl., tile*.maps., disk.; Yandex: vec*/sat*.maps.yandex.net,
  // статика с yastatic.net) — конкретный набор не документирован и может
  // меняться, поэтому разрешаем весь поддомен, а не перечисляем хосты.
  // apex-домены (без поддомена) добавлены отдельно — см. комментарий у script-src.
  // Своего домена в списке нет намеренно: 'self' покрывает его сам, каким бы
  // он ни был. Раньше здесь стоял https://ecash.kz — при развёртывании на
  // другом домене это была бы просто мёртвая строка с чужим адресом
  // (флаги валют рисуются локальным flag-icons, картинки новостей отдаются
  // своим же /api/media/, из апстрима изображения не грузятся).
  `img-src 'self' data: blob: https://*.2gis.com https://*.yandex.ru https://*.yandex.net https://yastatic.net https://*.yastatic.net`,
  `font-src 'self' https://*.2gis.com https://yastatic.net https://*.yastatic.net`,
  // Апстрима Ecash здесь нет намеренно: в api-dev.quiq.kz ходит только сервер,
  // браузеру достаточно своего origin. Из тайлов карты — 2GIS и Yandex.
  `connect-src 'self' https://*.2gis.com https://*.yandex.ru https://*.yandex.net https://yastatic.net https://*.yastatic.net${isProd ? '' : ' ws:'}`,
  // MapGL (как и MapLibre раньше) поднимает воркеры из blob-URL.
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
