/**
 * Сквозная проверка инвариантов макета по всем страницам и брейкпоинтам.
 *
 * Проверяет не «похоже ли», а конкретные числа, выведенные прямо из Figma:
 * высоту и боковые поля шапки, ширину контентной колонки, поля футера,
 * отсутствие горизонтального скролла и ошибок в консоли.
 *
 *   node scripts/check-layout.mjs [--theme light] [--base <url>] [--quiet]
 *   node scripts/check-layout.mjs --only главная,вход --bp 1920,360
 *
 * Код возврата 1, если хоть один инвариант нарушен, — годится для CI.
 */
import { chromium } from 'playwright';
import { mockApi } from './fixtures.mjs';

const rest = process.argv.slice(2);
const flag = (n, d) => {
  const i = rest.indexOf(n);
  return i === -1 ? d : rest[i + 1];
};
const base = flag('--base', process.env.BASE_URL ?? 'http://localhost:3100');
const theme = flag('--theme', 'dark');
const quiet = rest.includes('--quiet');

/** Брейкпоинты макета и выведенные из него значения. */
const BP = [
  // ширина, высота шапки (вкл. 1px границы), боковое поле шапки, ширина контентной колонки
  { w: 1920, h: 1080, headerH: 83, headerPad: 360, content: 1200, footerPadX: 360, footerPadTop: 80 },
  { w: 1024, h: 768, headerH: 83, headerPad: 52, content: 920, footerPadX: 52, footerPadTop: 60 },
  { w: 768, h: 1024, headerH: 83, headerPad: 52, content: 664, footerPadX: 52, footerPadTop: 60 },
  { w: 480, h: 840, headerH: 73, headerPad: 16, content: 448, footerPadX: 24, footerPadTop: 24 },
  { w: 360, h: 840, headerH: 73, headerPad: 16, content: 328, footerPadX: 24, footerPadTop: 24 },
];

/** Страницы: путь, нужна ли сессия, есть ли на них шапка/футер приложения. */
const PAGES = [
  { path: '/', auth: true, shell: true, name: 'главная' },
  { path: '/locations', auth: true, shell: true, name: 'отделения-список' },
  { path: '/locations?view=map', auth: true, shell: true, name: 'отделения-карта' },
  { path: '/booking', auth: true, shell: true, name: 'бронь' },
  { path: '/subscribe', auth: true, shell: true, name: 'подписка' },
  { path: '/individual-rate', auth: true, shell: true, name: 'индив-курс' },
  { path: '/profile', auth: true, shell: true, name: 'профиль' },
  { path: '/requests', auth: true, shell: true, name: 'заявки' },
  { path: '/notifications', auth: true, shell: true, name: 'уведомления' },
  { path: '/news', auth: true, shell: true, name: 'новости' },
  // Экраны входа в макете — только модалка (1784:153589 = «Modal/Log in» 480×600,
  // на 360 она же во весь экран), без шапки и футера приложения.
  { path: '/login', auth: false, shell: false, name: 'вход' },
  { path: '/signup', auth: false, shell: false, name: 'регистрация' },
  // Лендинг рисует собственную шапку с полупрозрачной заливкой (2153:195628).
  { path: '/franchise', auth: false, shell: false, name: 'лендинг' },
];

// Фильтры для быстрой прогонки одного экрана, а не всех 65
const onlyPages = flag('--only')?.split(',').map((s) => s.trim());
const onlyBp = flag('--bp')?.split(',').map(Number);
const bps = onlyBp ? BP.filter((b) => onlyBp.includes(b.w)) : BP;
const pages = onlyPages ? PAGES.filter((p) => onlyPages.includes(p.name)) : PAGES;

const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;
const fails = [];
const note = (page, bp, msg) => fails.push(`${page} @${bp}: ${msg}`);

const browser = await chromium.launch();
const origin = new URL(base);

// Сессию берём один раз на весь прогон: /api/auth/login ограничен 10 попытками в минуту.
let sessionCookies = [];
{
  const ctx = await browser.newContext();
  const r = await ctx.request.post(new URL('/api/auth/login', base).href, {
    data: { login: process.env.DEMO_LOGIN ?? '+77001112233', password: 'ecash2026' },
  });
  if (r.ok()) sessionCookies = (await ctx.cookies()).filter((c) => c.name === 'ecash_s');
  else console.error(`не удалось войти: ${r.status()} — страницы за сессией будут пропущены`);
  await ctx.close();
}

let checked = 0;
for (const bp of bps) {
  for (const p of pages) {
    if (p.auth && !sessionCookies.length) continue;
    const ctx = await browser.newContext({
      viewport: { width: bp.w, height: bp.h },
      deviceScaleFactor: 1,
      locale: 'ru-RU',
      colorScheme: theme === 'light' ? 'light' : 'dark',
      reducedMotion: 'reduce',
    });
    await ctx.addCookies([
      { name: 'theme', value: theme, domain: origin.hostname, path: '/' },
      ...(p.auth ? sessionCookies : []),
    ]);
    const page = await ctx.newPage();
    await mockApi(page);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 160)));

    const label = `${p.name}`;
    try {
      // networkidle не годится: на экране с картой MapLibre бесконечно
      // перезапрашивает тайлы, и ожидание тишины в сети никогда не наступает.
      const resp = await page.goto(new URL(p.path, base).href, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });
      if (!resp || resp.status() >= 400) note(label, bp.w, `HTTP ${resp?.status()}`);
      await page.waitForLoadState('load', { timeout: 30_000 }).catch(() => {});
      await page.waitForTimeout(1200);

      const m = await page.evaluate(() => {
        const h = document.querySelector('header');
        const f = document.querySelector('footer');
        const cs = (el) => (el ? getComputedStyle(el) : null);
        const box = (el) => (el ? el.getBoundingClientRect() : null);
        const inner = h?.firstElementChild;
        const finner = f?.firstElementChild;
        return {
          scrollW: document.documentElement.scrollWidth,
          headerBox: box(h) && { h: box(h).height },
          headerInner: inner && {
            x: box(inner).x,
            w: box(inner).width,
            padL: parseFloat(cs(inner).paddingLeft),
            padR: parseFloat(cs(inner).paddingRight),
          },
          footerInner: finner && {
            x: box(finner).x,
            padL: parseFloat(cs(finner).paddingLeft),
            padR: parseFloat(cs(finner).paddingRight),
            padT: parseFloat(cs(finner).paddingTop),
            w: box(finner).width,
          },
        };
      });

      if (m.scrollW > bp.w + 1) note(label, bp.w, `горизонтальный скролл: ${m.scrollW} > ${bp.w}`);
      if (errors.length) note(label, bp.w, `ошибки в консоли: ${errors[0]}`);

      if (p.shell) {
        if (!m.headerBox) note(label, bp.w, 'нет <header>');
        else if (!near(m.headerBox.h, bp.headerH))
          note(label, bp.w, `высота шапки ${m.headerBox.h.toFixed(1)} вместо ${bp.headerH}`);

        if (m.headerInner) {
          const left = m.headerInner.x + m.headerInner.padL;
          if (!near(left, bp.headerPad))
            note(label, bp.w, `левое поле шапки ${left.toFixed(1)} вместо ${bp.headerPad}`);
          const contentW = m.headerInner.w - m.headerInner.padL - m.headerInner.padR;
          if (!near(contentW, bp.content))
            note(label, bp.w, `колонка шапки ${contentW.toFixed(1)} вместо ${bp.content}`);
        }
        if (m.footerInner) {
          // колонка футера центрируется, поэтому поле — это отступ от края окна,
          // а не padding самого блока
          const fLeft = m.footerInner.x + m.footerInner.padL;
          if (!near(fLeft, bp.footerPadX))
            note(label, bp.w, `левое поле футера ${fLeft.toFixed(1)} вместо ${bp.footerPadX}`);
          if (!near(m.footerInner.padT, bp.footerPadTop))
            note(label, bp.w, `верхнее поле футера ${m.footerInner.padT} вместо ${bp.footerPadTop}`);
        }
      }
      checked++;
    } catch (e) {
      note(label, bp.w, `не открылась: ${String(e).slice(0, 120)}`);
    }
    await ctx.close();
  }
}
await browser.close();

if (!quiet) console.log(`тема: ${theme}, проверено экранов: ${checked}`);
if (fails.length) {
  console.log(`\nНАРУШЕНО ИНВАРИАНТОВ: ${fails.length}`);
  for (const f of fails) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log('\nвсе инварианты макета соблюдены');
