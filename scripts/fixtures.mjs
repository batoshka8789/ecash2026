/**
 * Фикстуры апстрима для замеров вёрстки.
 *
 * В дев-окружении нет настоящего ECASH_CLIENT_SECRET, поэтому /api/rates и
 * /api/departments отвечают 401, а курсы, отделения и график рисуют состояние
 * ошибки — сверять по ним геометрию невозможно. Здесь ответы подменяются
 * правдоподобными данными на уровне Playwright: файлы проекта не трогаем,
 * приложение об этом не знает.
 *
 * Формы ответов — по типам из src/lib/domain.ts.
 */

const CODES = ['USD', 'EUR', 'RUB', 'CNY', 'GOLD1', 'GBP', 'CHF', 'TRY', 'AED', 'KGS'];
const NAMES = {
  USD: 'Доллар США',
  EUR: 'Евро',
  RUB: 'Российский рубль',
  CNY: 'Китайский юань',
  GOLD1: 'Золото',
  GBP: 'Фунт стерлингов',
  CHF: 'Швейцарский франк',
  TRY: 'Турецкая лира',
  AED: 'Дирхам ОАЭ',
  KGS: 'Киргизский сом',
};

const DEPS = [
  { depId: 1, code: 'DOS', address: 'КАЗАХСТАН, АЛМАТЫ, ПР. ДОСТЫК, 240' },
  { depId: 2, code: 'ABY', address: 'КАЗАХСТАН, АЛМАТЫ, ПР. АБАЯ, 44' },
  { depId: 3, code: 'SAT', address: 'КАЗАХСТАН, АЛМАТЫ, УЛ. САТПАЕВА, 90' },
  { depId: 4, code: 'ALF', address: 'КАЗАХСТАН, АЛМАТЫ, УЛ. ФУРМАНОВА, 12' },
];
const COORDS = {
  1: { lat: 43.234, lon: 76.956 },
  2: { lat: 43.241, lon: 76.915 },
  3: { lat: 43.229, lon: 76.928 },
  4: { lat: 43.251, lon: 76.945 },
};

const json = (body) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

/** История курса — ровный ряд точек, чтобы график был не пустым. */
const history = (n, base) =>
  Array.from({ length: n }, (_, i) => ({
    date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
    buy: +(base + Math.sin(i / 3) * 4).toFixed(2),
    sell: +(base + 2.4 + Math.sin(i / 3) * 4).toFixed(2),
  }));

const depCurrencies = (shift) =>
  CODES.slice(0, 6).map((code, i) => ({
    code,
    name: NAMES[code],
    buy: 539 + shift + i,
    sell: 541.4 + shift + i,
    buyDiff: 0.5,
    buyDiffDir: '+',
    sellDiff: 0.4,
    sellDiffDir: '-',
    flagUrl: null,
  }));

/**
 * Вешает перехват на все апстрим-зависимые ручки.
 * @param {import('playwright').Page} page
 */
export async function mockApi(page) {
  await page.route('**/api/rates?*', (r) =>
    r.fulfill(
      json({
        depId: 1,
        marketRate: 538.45,
        marketRates: Object.fromEntries(CODES.map((c) => [c, 538.45])),
        rates: CODES.map((c, i) => ({
          currencyCode: c,
          currencyName: NAMES[c],
          buy: 539 + i,
          sell: 541.4 + i,
          change: i % 2 ? 0.2 : -0.3,
          history: history(12, 539 + i),
        })),
        favorites: [],
        competitors: [
          { id: 'c1', nameKey: 'blue', color: '#1E9FED', buy: 538.5, sell: 542 },
          { id: 'c2', nameKey: 'green', color: '#25A423', buy: 538.2, sell: 541.8 },
          { id: 'c3', nameKey: 'red', color: '#ED3E1E', buy: 537.9, sell: 542.4 },
        ],
      }),
    ),
  );

  await page.route('**/api/rates/history*', (r) => {
    const u = new URL(r.request().url());
    const period = u.searchParams.get('period') ?? 'month';
    const n = { day: 24, week: 7, month: 12, quarter: 16, year: 12 }[period] ?? 12;
    return r.fulfill(json({ current: { buy: 539, sell: 541.4 }, points: history(n, 539) }));
  });

  await page.route('**/api/rates/best*', (r) =>
    r.fulfill(
      json({
        best: {
          city: null,
          currencyCode: 'USD',
          bestBuy: { depId: 1, address: DEPS[0].address, rate: 540 },
          bestSale: { depId: 2, address: DEPS[1].address, rate: 541 },
        },
      }),
    ),
  );

  await page.route('**/api/departments', (r) => r.fulfill(json({ departments: DEPS })));
  await page.route(/\/api\/departments\/(\d+)$/, (r) => {
    const id = +new URL(r.request().url()).pathname.split('/').pop();
    const d = DEPS.find((x) => x.depId === id) ?? DEPS[0];
    return r.fulfill(
      json({
        department: {
          ...d,
          name: `Ecash ${d.code}`,
          city: 'Алматы',
          coords: COORDS[id] ?? COORDS[1],
          timetable: { openTime: '08:00', closeTime: '20:00' },
          ratesUpdatedAt: null,
          currencies: depCurrencies(id),
        },
      }),
    );
  });

  /*
   * Тайлы карты — внешний ресурс: для замеров вёрстки не нужен и только тормозит.
   * Отдаём заглушку, а не abort: на отменённый запрос MapLibre пишет в консоль
   * ERR_FAILED и бесконечно повторяет попытку, и то и другое портит проверку.
   */
  const TILE = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64',
  );
  await page.route('**://tile.openstreetmap.org/**', (r) =>
    r.fulfill({ status: 200, contentType: 'image/png', body: TILE }),
  );
}
