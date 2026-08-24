#!/usr/bin/env node
/**
 * Проверка развёрнутого сайта одной командой.
 *
 *   npm run check:deploy -- https://ваш-домен
 *
 * Обходит всё, что должно работать сразу после запуска, и печатает понятный
 * отчёт: что в порядке, что сломано и что именно чинить. Ничего не меняет —
 * только читает, поэтому запускать можно и на боевом сайте.
 *
 * Зачем отдельный скрипт: после переключения на боевой API вопросов ровно
 * два — «ключи приняли?» и «всё ли отдаётся правильно?». Проверять их
 * вручную по десятку адресов долго и легко пропустить главное.
 */

const base = (process.argv[2] ?? process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const OFF = '\x1b[0m';

let failed = 0;
let warned = 0;

const ok = (msg, extra = '') => console.log(`  ${GREEN}✓${OFF} ${msg}${extra ? ` ${DIM}${extra}${OFF}` : ''}`);
const bad = (msg, how) => {
  failed += 1;
  console.log(`  ${RED}✗${OFF} ${msg}`);
  if (how) console.log(`      ${DIM}→ ${how}${OFF}`);
};
const warn = (msg, how) => {
  warned += 1;
  console.log(`  ${YELLOW}!${OFF} ${msg}`);
  if (how) console.log(`      ${DIM}→ ${how}${OFF}`);
};

async function get(path) {
  try {
    const res = await fetch(base + path, {
      redirect: 'manual',
      headers: { 'user-agent': 'ecash-deploy-check' },
      signal: AbortSignal.timeout(20000),
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* не JSON — так и надо для страниц */
    }
    return { status: res.status, text, json };
  } catch (e) {
    return { status: 0, text: '', json: null, error: e instanceof Error ? e.message : String(e) };
  }
}

console.log(`\nПроверка развёртывания: ${base}\n`);

/* ------------------------------------------------------------- 1. здоровье */
console.log('1. Состояние сервера');
const health = await get('/api/health');

if (health.status === 0) {
  bad(`сервер недоступен: ${health.error}`, 'проверьте, что контейнер запущен и адрес указан верно');
} else if (!health.json) {
  bad(`/api/health вернул не JSON (код ${health.status})`, 'перед приложением стоит прокси, отдающий свою страницу?');
} else {
  const { db, ecash } = health.json;
  if (db === 'up') ok('база данных отвечает');
  else bad('база данных недоступна', 'проверьте DATABASE_URL и доступность PostgreSQL');

  if (ecash === 'ok') ok('Ecash: ключи приняты');
  else if (ecash === 'bad-credentials')
    bad('Ecash отверг ключи приложения', 'проверьте ECASH_CLIENT_ID и ECASH_CLIENT_SECRET — нужна БОЕВАЯ пара');
  else if (ecash === 'unreachable')
    bad('до Ecash не достучались', 'проверьте ECASH_API_BASE_URL и исходящую сеть с сервера');
  else warn(`состояние Ecash: ${ecash}`, 'сервер ещё не завершил проверку — повторите через минуту');
}

/* ------------------------------------------------------------ 2. данные */
console.log('\n2. Данные из Ecash');
const deps = await get('/api/departments');
const depCount = deps.json?.departments?.length ?? 0;
if (depCount > 0) ok('отделения получены', `${depCount} шт.`);
else bad('список отделений пуст', 'Ecash не отдал отделения — проверьте ключи и контур');

const suspicious = (deps.json?.departments ?? []).filter((d) =>
  /тест|test|проверк|devtest/i.test(`${d.code ?? ''} ${d.address ?? ''}`),
);
if (suspicious.length) {
  warn(
    `среди отделений есть служебные: ${suspicious.map((d) => `${d.depId} «${d.code}»`).join(', ')}`,
    'если это боевой контур — сообщите своей команде; скрыть можно через HIDDEN_DEP_IDS',
  );
}

const rates = await get('/api/rates');
const rateCount = rates.json?.rates?.length ?? 0;
if (rateCount > 0) ok('курсы получены', `${rateCount} валют, отделение ${rates.json.depId}`);
else bad('курсы не получены', 'Ecash не отдал статистику ни по одному отделению');

const best = await get('/api/rates/best?currency=USD');
if (best.json?.best?.bestBuy?.rate) ok('лучший курс считается', `USD: покупка ${best.json.best.bestBuy.rate}`);
else warn('лучший курс не посчитался', 'обычно значит, что USD нет в списке валют контура');

/* ------------------------------------------------------- 3. свой домен */
console.log('\n3. Собственный домен в разметке');
const host = base.replace(/^https?:\/\//, '');
const sitemap = await get('/sitemap.xml');
if (sitemap.status !== 200) {
  bad(`sitemap.xml отдаёт ${sitemap.status}`);
} else if (sitemap.text.includes('ecash.kz') && !host.includes('ecash.kz')) {
  bad(
    'в sitemap.xml чужой домен ecash.kz',
    'NEXT_PUBLIC_SITE_URL не передан ПРИ СБОРКЕ: docker build --build-arg NEXT_PUBLIC_SITE_URL=https://ваш-домен',
  );
} else if (sitemap.text.includes(host)) {
  ok('sitemap.xml содержит ваш домен');
} else {
  warn('в sitemap.xml не найден ваш домен', 'проверьте NEXT_PUBLIC_SITE_URL');
}

/* --------------------------------------------------------- 4. страницы */
console.log('\n4. Публичные страницы');
const pages = ['/', '/news', '/franchise', '/locations', '/booking', '/individual-rate', '/subscribe', '/login', '/signup', '/legal/consent', '/legal/privacy'];
const badPages = [];
for (const p of pages) {
  const r = await get(p);
  if (r.status !== 200) badPages.push(`${p} → ${r.status}`);
}
if (badPages.length === 0) ok('все страницы открываются', `${pages.length} шт.`);
else bad(`не открылись: ${badPages.join(', ')}`);

/* ------------------------------------------------------ 5. безопасность */
console.log('\n5. Закрытые разделы');
const guarded = [
  ['/api/admin/news', 401, 'админский API'],
  ['/api/requests', 401, 'заявки'],
  ['/api/notifications', 401, 'уведомления'],
];
let guardOk = true;
for (const [p, want, label] of guarded) {
  const r = await get(p);
  if (r.status !== want) {
    bad(`${label} (${p}) отдаёт ${r.status}, ожидалось ${want}`);
    guardOk = false;
  }
}
if (guardOk) ok('гостю закрыты админка, заявки и уведомления');

const admin = await get('/admin/news');
if ([307, 302, 404].includes(admin.status)) ok('раздел /admin гостю не показывается', `код ${admin.status}`);
else bad(`/admin/news отдаёт ${admin.status} — раздел доступен без входа!`);

/* ---------------------------------------------------------- 6. push */
console.log('\n6. Push-уведомления');
const pk = await get('/api/push/public-key');
if (!pk.json?.enabled) {
  warn('push выключены', 'не заданы VAPID_PUBLIC_KEY и VAPID_PRIVATE_KEY — уведомления о курсе приходить не будут');
} else {
  ok('ключ подписки отдаётся');
  const sw = await get('/sw.js');
  if (sw.status === 200) ok('служебный воркер доступен');
  else bad(`/sw.js отдаёт ${sw.status}`, 'без него push не работает');
  if (!base.startsWith('https://') && !base.includes('localhost')) {
    bad('сайт открыт не по HTTPS', 'Web Push работает только в защищённом контексте');
  }
}

/* --------------------------------------------------------------- итог */
console.log('\n' + '─'.repeat(58));
if (failed === 0 && warned === 0) {
  console.log(`${GREEN}Всё в порядке — сайт готов к работе.${OFF}\n`);
} else if (failed === 0) {
  console.log(`${YELLOW}Ошибок нет, предупреждений: ${warned}.${OFF}`);
  console.log(`${DIM}Предупреждение — это не поломка, но стоит посмотреть.${OFF}\n`);
} else {
  console.log(`${RED}Ошибок: ${failed}${OFF}${warned ? `, предупреждений: ${warned}` : ''}.`);
  console.log(`${DIM}Подробности по каждой — выше, со стрелкой →${OFF}\n`);
}
process.exit(failed > 0 ? 1 : 0);
