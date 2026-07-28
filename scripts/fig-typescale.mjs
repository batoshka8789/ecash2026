/**
 * Полная типографическая шкала реализуемых экранов макета:
 * каждое сочетание семейство/начертание/кегль/интерлиньяж/трекинг + где встречается.
 * Запуск из корня проекта: node --max-old-space-size=12288 <файл>
 */
import fs from 'node:fs';

const raw = JSON.parse(fs.readFileSync('design/raw/doc.json', 'utf8'));
const nodes = raw.nodeChanges;
const gid = (g) => (g ? `${g.sessionID}:${g.localID}` : null);
const byId = new Map(nodes.map((n) => [gid(n.guid), n]));
const kids = new Map();
for (const n of nodes) {
  const p = n.parentIndex?.guid ? gid(n.parentIndex.guid) : null;
  if (!p) continue;
  if (!kids.has(p)) kids.set(p, []);
  kids.get(p).push(n);
}
const effKids = (id) => {
  const own = kids.get(id);
  if (own?.length) return own;
  const s = byId.get(id)?.symbolData?.symbolID;
  const sid = s ? gid(s) : null;
  return sid && sid !== id ? (kids.get(sid) ?? []) : [];
};
const ch = (v) => Math.round((v ?? 0) * 255);
const hex = (c) =>
  c ? '#' + [ch(c.r), ch(c.g), ch(c.b)].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase() : '?';

const SCREENS = {
  'главная': ['1279:104497', '1279:104507', '1279:104517', '1279:104710', '1279:104972'],
  'отделения-список': ['1279:108407', '1279:108798', '1279:109241', '1279:111654', '1279:112405'],
  'отделения-карта': ['1279:113109', '1279:113327', '1279:113815', '1355:88222', '1355:88730'],
  'график': ['1546:143209', '1546:146615', '1546:135630', '1546:134087', '1546:130417'],
  'дропдаун-валют': ['1770:150656', '1770:154842', '1770:157357', '1774:41652', '1770:124763'],
  'подписка': ['1774:157048', '1774:158082', '1774:158388', '1774:158929', '1774:158744'],
  'бронь': ['1783:125768', '1783:126009', '1783:126634', '1783:128226', '1783:128004'],
  'индив-курс': ['1784:140901', '1784:141142', '1784:141564', '1784:142431', '1784:142212'],
  'вход': ['1784:153589', '1784:153686', '1784:153734', '1784:153863', '1784:153822'],
  'кабинет': ['1810:138539', '1810:152339', '1810:149353', '1810:147157', '1761:115778'],
  'лендинг': ['2153:195405', '2153:195710', '2153:195935', '2153:196159', '2153:196355'],
};

const scale = new Map();

function walk(id, area, depth) {
  if (depth > 40) return;
  const n = byId.get(id);
  if (!n || n.visible === false) return;
  if (n.type === 'TEXT' && n.fontName?.family) {
    const lh = n.lineHeight
      ? n.lineHeight.units === 'PIXELS'
        ? `${+n.lineHeight.value.toFixed(2)}px`
        : `${+(n.lineHeight.value).toFixed(3)}`
      : 'auto';
    const ls = n.letterSpacing?.value
      ? `${+n.letterSpacing.value.toFixed(2)}${n.letterSpacing.units === 'PERCENT' ? '%' : 'px'}`
      : '0';
    const key = `${n.fontName.family} ${n.fontName.style}|${n.fontSize}|${lh}|${ls}`;
    if (!scale.has(key)) scale.set(key, { n: 0, areas: new Set(), colors: new Map(), samples: [] });
    const g = scale.get(key);
    g.n++;
    g.areas.add(area);
    const c = hex(n.fillPaints?.[0]?.color);
    g.colors.set(c, (g.colors.get(c) ?? 0) + 1);
    const t = (n.textData?.characters ?? '').trim().slice(0, 26);
    if (t && g.samples.length < 3 && !g.samples.includes(t)) g.samples.push(t);
  }
  for (const k of effKids(id)) walk(gid(k.guid), area, depth + 1);
}

for (const [area, ids] of Object.entries(SCREENS)) for (const id of ids) walk(id, area, 0);

const rows = [...scale.entries()].sort((a, b) => b[1].n - a[1].n);
console.log(`сочетаний: ${rows.length}\n`);
console.log('шрифт / начертание | кегль | line-height | трекинг | шт | цвета | разделы | примеры');
for (const [key, g] of rows) {
  const [fam, size, lh, ls] = key.split('|');
  const colors = [...g.colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, k]) => `${c}×${k}`).join(' ');
  console.log(
    `${fam} | ${size} | ${lh} | ${ls} | ${g.n} | ${colors} | ${[...g.areas].join(',')} | ${g.samples.join(' · ')}`,
  );
}
