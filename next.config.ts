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
  /**
   * SignalR нельзя бандлить: в Node-ветке он грузит транспорты динамическим
   * require, а бандлер подменяет require заглушкой, которая бросает
   * «dynamic usage of require is not supported».
   *
   *   // @microsoft/signalr/dist/esm/HttpConnection.js
   *   if (Platform.isNode && typeof require !== "undefined") {
   *     const requireFunc = typeof __webpack_require__ === "function"
   *       ? __non_webpack_require__ : require;
   *     webSocketModule = requireFunc("ws");
   *     eventSourceModule = requireFunc("eventsource");
   *   }
   *
   * Обход по `__webpack_require__` рассчитан на webpack и здесь не срабатывает,
   * а бросок происходит до любых опций — передать готовый WebSocket снаружи
   * не помогает. В dev это незаметно (модули не бандлятся), в проде хаб падал
   * при каждом подключении, кабинет молча уезжал на поллинг: в логе
   * «[events] SignalR недоступен, отдаю degraded».
   *
   * ws, eventsource, node-fetch, abort-controller и tough-cookie — обычные
   * dependencies самого signalr, в standalone-вывод они трассируются.
   */
  serverExternalPackages: ['@microsoft/signalr'],
  /**
   * Продолжение той же истории. Вывести signalr из бандла мало: его транспорты
   * подключаются динамическим require, а трассировщик файлов видит только
   * статические импорты — сам пакет в standalone попадает, его зависимости нет.
   * В образе это дало бы ту же деградацию хаба, только с MODULE_NOT_FOUND.
   *
   * Список — полное транзитивное замыкание зависимостей signalr. Ветки под
   * `fetch` и `AbortController` на Node 22 не срабатывают (оба есть глобально),
   * но `ws`, `eventsource`, `tough-cookie` и `fetch-cookie` грузятся всегда:
   * условие у cookie-jar — `typeof fetch === "undefined" || Platform.isNode`,
   * на сервере вторая половина истинна. Пересчитать при обновлении signalr.
   *
   * Ключ — маршрут SSE-потока: единственное место, где мы поднимаем хаб.
   */
  outputFileTracingIncludes: {
    '/api/events': [
      './node_modules/{ws,eventsource,tough-cookie,fetch-cookie,node-fetch,abort-controller}/**/*',
      './node_modules/{event-target-shim,set-cookie-parser,psl,punycode,universalify}/**/*',
      './node_modules/{url-parse,querystringify,requires-port}/**/*',
      './node_modules/{whatwg-url,tr46,webidl-conversions}/**/*',
    ],
  },
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
