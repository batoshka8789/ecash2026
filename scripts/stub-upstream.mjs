/**
 * Локальная заглушка апстрима Ecash — чтобы сайт можно было посмотреть без
 * настоящего ECASH_CLIENT_SECRET (с заглушкой в .env.local апстрим отдаёт 401,
 * и вместо курсов, отделений и графика рисуются карточки ошибок).
 *
 *   node scripts/stub-upstream.mjs [порт]        # по умолчанию 4010
 *   ECASH_API_BASE_URL=http://127.0.0.1:4010 npm run dev
 *
 * Реализует ровно те ручки, которые дёргает BFF (src/server/ecash/endpoints):
 *   POST /mobile/service/token
 *   GET  /mobile/rates/statistics/:depId
 *   GET  /mobile/rates/best-rate?currency=&city=
 *   GET  /Department/depListApp
 *   GET  /Department/depInfo/:depId
 *
 * Данные выдуманные и детерминированные — это стенд для проверки вёрстки,
 * а не источник настоящих курсов.
 */
import http from 'node:http';

const port = Number(process.argv[2] ?? 4010);

const CURRENCIES = [
  ['USD', 'Доллар США', 539.0, 541.4],
  ['EUR', 'Евро', 583.2, 586.1],
  ['RUB', 'Российский рубль', 5.62, 5.79],
  ['CNY', 'Китайский юань', 73.4, 74.8],
  ['GOLD1', 'Золотой слиток 1 г', 44150, 45900],
  ['GBP', 'Фунт стерлингов', 682.5, 687.0],
  ['CHF', 'Швейцарский франк', 611.3, 615.9],
  ['TRY', 'Турецкая лира', 13.9, 14.6],
  ['AED', 'Дирхам ОАЭ', 146.2, 148.1],
  ['KGS', 'Киргизский сом', 6.11, 6.32],
];

const DEPS = [
  { depId: 1, code: 'DOS', address: 'КАЗАХСТАН, АЛМАТЫ, ПР. ДОСТЫК, 240', name: 'Ecash Достык', lat: 43.234, lon: 76.956 },
  { depId: 2, code: 'ABY', address: 'КАЗАХСТАН, АЛМАТЫ, ПР. АБАЯ, 44', name: 'Ecash Абая', lat: 43.241, lon: 76.915 },
  { depId: 3, code: 'SAT', address: 'КАЗАХСТАН, АЛМАТЫ, УЛ. САТПАЕВА, 90', name: 'Ecash Сатпаева', lat: 43.229, lon: 76.928 },
  { depId: 4, code: 'FUR', address: 'КАЗАХСТАН, АЛМАТЫ, УЛ. ФУРМАНОВА, 12', name: 'Ecash Фурманова', lat: 43.251, lon: 76.945 },
  { depId: 5, code: 'AUZ', address: 'КАЗАХСТАН, АЛМАТЫ, ПР. АЛЬ-ФАРАБИ, 77', name: 'Ecash Аль-Фараби', lat: 43.219, lon: 76.907 },
];

/** Ряд точек истории: ровный, но с волной — чтобы график был читаемым. */
const history = (base, days = 30) =>
  Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.UTC(2026, 6, 27) - (days - 1 - i) * 86400000);
    const wave = Math.sin(i / 4) * base * 0.012 + Math.cos(i / 7) * base * 0.006;
    return {
      date: d.toISOString().slice(0, 10),
      buy: +(base + wave).toFixed(2),
      sell: +(base + wave + base * 0.0045).toFixed(2),
    };
  });

const statistics = (depId) =>
  CURRENCIES.map(([code, name, buy, sell], i) => {
    const shift = (depId - 1) * 0.35;
    return {
      currencyCode: code,
      currencyName: name,
      buy: +(buy + shift).toFixed(2),
      sell: +(sell + shift).toFixed(2),
      change: +((i % 3) - 1).toFixed(2) * 0.4,
      history: history(buy + shift),
    };
  });

const currencyList = (depId) =>
  CURRENCIES.slice(0, 8).map(([code, name, buy, sell], i) => ({
    currCode: code,
    currDescr: name,
    buy: +(buy + (depId - 1) * 0.35).toFixed(2),
    sale: +(sell + (depId - 1) * 0.35).toFixed(2),
    buyDiff: +(0.2 + i * 0.05).toFixed(2),
    buyDiffDir: i % 2 ? '-' : '+',
    saleDiff: +(0.3 + i * 0.04).toFixed(2),
    saleDiffDir: i % 3 ? '+' : '-',
    currImage: null,
  }));

const json = (res, body, status = 200) => {
  const s = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(s),
  });
  res.end(s);
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;
  console.log(`${req.method} ${p}${url.search}`);

  if (req.method === 'POST' && p === '/mobile/service/token') {
    // тело с clientId/clientSecret не проверяем — это стенд
    return json(res, {
      accessToken: 'stub-service-token',
      refreshToken: 'stub-refresh-token',
      expiresIn: 3600,
      tokenType: 'Bearer',
    });
  }

  let m = p.match(/^\/mobile\/rates\/statistics\/(\d+)$/);
  if (m) return json(res, statistics(Number(m[1])));

  if (p === '/mobile/rates/best-rate') {
    const currency = url.searchParams.get('currency') ?? 'USD';
    const row = CURRENCIES.find(([c]) => c === currency) ?? CURRENCIES[0];
    return json(res, {
      city: url.searchParams.get('city') || null,
      currencyCode: currency,
      bestBuy: { depId: 2, address: DEPS[1].address, rate: +(row[2] + 0.6).toFixed(2) },
      bestSale: { depId: 3, address: DEPS[2].address, rate: +(row[3] - 0.5).toFixed(2) },
    });
  }

  if (p === '/Department/depListApp')
    return json(res, DEPS.map(({ depId, code, address }) => ({ depId, code, address })));

  m = p.match(/^\/Department\/depInfo\/(\d+)$/);
  if (m) {
    const id = Number(m[1]);
    const d = DEPS.find((x) => x.depId === id) ?? DEPS[0];
    return json(res, {
      ...d,
      timetable: { openTime: '08:00', closeTime: '20:00' },
      ratesUpdatedAt: new Date().toISOString(),
      currencyList: currencyList(id),
    });
  }

  console.log(`  ↳ 404 (ручка не реализована в заглушке)`);
  json(res, { error: 'not_found', path: p }, 404);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`заглушка апстрима Ecash слушает http://127.0.0.1:${port}`);
});
