/**
 * Снимает фактические вычисленные стили страницы, чтобы сверять с макетом
 * не «по коду», а по реально отрисованным пикселям.
 *
 *   node scripts/measure.mjs <path> <width> [опции]
 *
 *   node scripts/measure.mjs /ru 1920
 *   node scripts/measure.mjs /ru/booking 360 --theme light
 *   node scripts/measure.mjs /ru 1920 --sel 'header' --depth 6
 *   node scripts/measure.mjs /ru 1920 --shot design/raw/shots/main-1920.png
 *
 * Опции:
 *   --base <url>     база (по умолчанию $BASE_URL или http://localhost:3100)
 *   --sel <css>      корень обхода (по умолчанию body)
 *   --depth <n>      глубина обхода (по умолчанию 8)
 *   --theme <t>      dark | light (по умолчанию dark)
 *   --auth           войти демо-аккаунтом (нужно для «/» = ExchangeHome и кабинета)
 *   --mock           подменить ответы апстрима фикстурами (курсы, отделения, график)
 *   --wait <ms>      доп. ожидание после загрузки (по умолчанию 900)
 *   --shot <path>    сохранить полный скриншот
 *   --json           выдать JSON вместо дерева
 *   --all            не схлопывать однотипных соседей
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { chromium } from 'playwright';
import { mockApi } from './fixtures.mjs';

const [, , routeArg, widthArg, ...rest] = process.argv;
if (!routeArg) {
  console.error('нужен путь, например: node scripts/measure.mjs /ru 1920');
  process.exit(1);
}
const flag = (n, d) => {
  const i = rest.indexOf(n);
  return i === -1 ? d : rest[i + 1];
};
const has = (n) => rest.includes(n);

const base = flag('--base', process.env.BASE_URL ?? 'http://localhost:3100');
const width = +(widthArg ?? 1920);
const height = +flag('--height', width >= 1024 ? 1080 : width >= 768 ? 1024 : 840);
const depth = +flag('--depth', 8);
const theme = flag('--theme', 'dark');
const waitMs = +flag('--wait', 900);
const rootSel = flag('--sel', 'body');
const shot = flag('--shot');

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 1,
  locale: 'ru-RU',
  colorScheme: theme === 'light' ? 'light' : 'dark',
  reducedMotion: 'reduce',
});

// Тему сервер читает из куки и проставляет data-theme при рендере —
// подменять её скриптом в браузере нельзя, будет рассинхрон с SSR.
const origin = new URL(base);
await context.addCookies([
  { name: 'theme', value: theme, domain: origin.hostname, path: '/' },
]);

/*
 * «/» гостю отдаёт лендинг франшизы, а экран Main page из макета — это
 * ExchangeHome для авторизованного. Кабинет тоже за сессией.
 *
 * /api/auth/login ограничен 10 попытками в минуту, а замеров мы делаем сотни,
 * поэтому кука сессии кэшируется в файле и переиспользуется, пока жива.
 */
const SESSION_FILE = path.join(os.tmpdir(), 'ecash-measure-session.json');
if (has('--auth')) {
  const cached = fs.existsSync(SESSION_FILE)
    ? JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'))
    : null;
  const fresh = cached && Date.now() - cached.at < 20 * 60_000;
  if (fresh) {
    await context.addCookies(cached.cookies);
  } else {
    const r = await context.request.post(new URL('/api/auth/login', base).href, {
      data: { login: process.env.DEMO_LOGIN ?? '+77001112233', password: 'ecash2026' },
    });
    if (r.ok()) {
      const cookies = (await context.cookies()).filter((c) => c.name === 'ecash_s');
      fs.writeFileSync(SESSION_FILE, JSON.stringify({ at: Date.now(), cookies }));
    } else if (cached) {
      // Упёрлись в лимит — старая кука всё ещё лучше, чем гость
      await context.addCookies(cached.cookies);
      console.error(`вход не удался (${r.status()}), взята сохранённая сессия`);
    } else {
      console.error(`вход не удался: ${r.status()} ${await r.text()}`);
    }
  }
}

const page = await context.newPage();

if (has('--mock')) await mockApi(page);

const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text().slice(0, 300)));
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 300)}`));

const url = new URL(routeArg, base).href;
const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => null);
await page.waitForTimeout(waitMs);

const data = await page.evaluate(
  ({ depth, rootSel, collapse }) => {
    const px = (v) => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? +n.toFixed(2) : v;
    };
    const rgbHex = (v) => {
      if (!v || v === 'none') return null;
      const m = v.match(/rgba?\(([^)]+)\)/);
      if (!m) return v;
      const [r, g, b, a = '1'] = m[1].split(/[,\s/]+/).filter(Boolean);
      if (+a === 0) return 'transparent';
      const h =
        '#' +
        [r, g, b]
          .map((x) => (+x).toString(16).padStart(2, '0'))
          .join('')
          .toUpperCase();
      return +a >= 0.999 ? h : `${h} ${+(+a * 100).toFixed(1)}%`;
    };
    const label = (el) => {
      const id = el.id ? `#${el.id}` : '';
      const cls = (el.getAttribute('class') ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 6)
        .join('.');
      return `${el.tagName.toLowerCase()}${id}${cls ? '.' + cls : ''}`;
    };

    function walk(el, d) {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (r.width === 0 && r.height === 0 && s.display === 'none') return null;

      const o = {
        el: label(el),
        box: `${+r.width.toFixed(2)}×${+r.height.toFixed(2)} @ ${+r.x.toFixed(2)},${+r.y.toFixed(2)}`,
      };
      const disp = s.display;
      if (disp === 'flex' || disp === 'inline-flex' || disp === 'grid') {
        o.layout = `${disp} ${s.flexDirection ?? ''}`.trim();
        if (s.gap && s.gap !== 'normal') o.gap = s.gap;
        if (s.justifyContent !== 'normal') o.justify = s.justifyContent;
        if (s.alignItems !== 'normal') o.align = s.alignItems;
        if (s.flexWrap !== 'nowrap') o.wrap = s.flexWrap;
      }
      const pad = [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map(px);
      if (pad.some((v) => v)) o.padding = pad.join(' ');
      const mar = [s.marginTop, s.marginRight, s.marginBottom, s.marginLeft].map(px);
      if (mar.some((v) => v)) o.margin = mar.join(' ');

      const bg = rgbHex(s.backgroundColor);
      if (bg && bg !== 'transparent') o.bg = bg;
      if (s.backgroundImage && s.backgroundImage !== 'none')
        o.bgImage = s.backgroundImage.slice(0, 160);

      const bw = [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth].map(
        px,
      );
      if (bw.some((v) => v)) {
        o.border = `${bw.join(' ')} ${s.borderTopStyle} ${rgbHex(s.borderTopColor)}`;
        const bc = [s.borderTopColor, s.borderRightColor, s.borderBottomColor, s.borderLeftColor].map(
          rgbHex,
        );
        if (new Set(bc).size > 1) o.borderColors = bc.join(' ');
      }
      const rad = [
        s.borderTopLeftRadius,
        s.borderTopRightRadius,
        s.borderBottomRightRadius,
        s.borderBottomLeftRadius,
      ].map(px);
      if (rad.some((v) => v)) o.radius = rad.join(' ');
      if (s.boxShadow && s.boxShadow !== 'none') o.shadow = s.boxShadow.slice(0, 200);
      if (s.opacity !== '1') o.opacity = s.opacity;
      if (s.overflowX !== 'visible' || s.overflowY !== 'visible')
        o.overflow = `${s.overflowX}/${s.overflowY}`;
      if (s.position !== 'static') o.position = `${s.position} ${s.top} ${s.left}`.trim();

      // типографика — только там, где узел непосредственно несёт текст
      const ownText = [...el.childNodes]
        .filter((n) => n.nodeType === 3 && n.textContent.trim())
        .map((n) => n.textContent.trim())
        .join(' ');
      if (ownText) {
        o.text = ownText.length > 80 ? ownText.slice(0, 80) + '…' : ownText;
        o.color = rgbHex(s.color);
        o.font = `${s.fontFamily.split(',')[0].replace(/["']/g, '')} ${s.fontWeight} ${px(s.fontSize)}px/${px(s.lineHeight)}`;
        if (s.letterSpacing !== 'normal') o.letterSpacing = s.letterSpacing;
        if (s.textTransform !== 'none') o.textTransform = s.textTransform;
        if (s.textAlign !== 'start') o.textAlign = s.textAlign;
      }
      if (el.tagName === 'IMG' || el.tagName === 'SVG' || el.tagName === 'svg') {
        o.src = el.getAttribute('src') ?? el.getAttribute('data-src') ?? undefined;
      }

      if (d > 0) {
        const kids = [...el.children].map((k) => walk(k, d - 1)).filter(Boolean);
        // Схлопываем длинные ряды одинаковых по классу соседей: список из 20
        // одинаковых строк ничего не добавляет к спеке, но раздувает вывод.
        if (collapse) {
          const out = [];
          for (const k of kids) {
            const prev = out[out.length - 1];
            if (prev && prev.el === k.el && prev.__n >= 2) {
              prev.__n++;
              prev.repeatedBoxes.push(k.box);
              continue;
            }
            if (prev && prev.el === k.el && !prev.__n) {
              prev.__n = 2;
              prev.repeatedBoxes = [prev.box, k.box];
              continue;
            }
            out.push(k);
          }
          for (const k of out)
            if (k.__n) {
              k.repeated = `×${k.__n}`;
              delete k.__n;
            }
          if (out.length) o.children = out;
        } else if (kids.length) o.children = kids;
      }
      return o;
    }

    const root = document.querySelector(rootSel);
    return {
      title: document.title,
      themeAttr: document.documentElement.getAttribute('data-theme'),
      scrollW: document.documentElement.scrollWidth,
      scrollH: document.documentElement.scrollHeight,
      tree: root ? walk(root, depth) : { error: `нет узла ${rootSel}` },
    };
  },
  { depth, rootSel, collapse: !has('--all') },
);

if (shot) {
  fs.mkdirSync(path.dirname(shot), { recursive: true });
  await page.screenshot({ path: shot, fullPage: true });
}
await browser.close();

const meta = {
  url,
  status: resp?.status() ?? 'нет ответа',
  viewport: `${width}×${height}`,
  theme,
  scroll: `${data.scrollW}×${data.scrollH}`,
  overflowX: data.scrollW > width ? `ГОРИЗОНТАЛЬНЫЙ СКРОЛЛ: ${data.scrollW} > ${width}` : 'нет',
  consoleErrors: consoleErrors.slice(0, 10),
};

if (has('--json')) {
  console.log(JSON.stringify({ meta, ...data }, null, 1));
} else {
  console.log(
    Object.entries(meta)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? (v.length ? '\n  - ' + v.join('\n  - ') : 'нет') : v}`)
      .join('\n'),
  );
  console.log('');
  const fmt = (o) =>
    Object.entries(o)
      .filter(([k]) => k !== 'el' && k !== 'children' && k !== 'repeatedBoxes')
      .map(([k, v]) => `${k}=${v}`)
      .join('  ');
  const render = (n, ind = '') => {
    console.log(`${ind}${n.el}  ${fmt(n)}`);
    if (n.repeatedBoxes) console.log(`${ind}  ↳ повторы: ${n.repeatedBoxes.join(' | ')}`);
    for (const k of n.children ?? []) render(k, ind + '  ');
  };
  render(data.tree);
}
