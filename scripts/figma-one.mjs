#!/usr/bin/env node
/**
 * Тянет ОДИН узел через /v1/files/:key/nodes?ids=... (без скачивания всего файла)
 * и печатает дерево с текстами, размерами, цветами и автолэйаутами.
 *
 *   node scripts/figma-one.mjs 1770:149873           # структура (depth 6)
 *   node scripts/figma-one.mjs 1770:149873 --text    # только тексты по порядку
 *   node scripts/figma-one.mjs 1770:149873 --depth 8 # глубже
 *   node scripts/figma-one.mjs 1770:149873 --save    # сохранить поддерево в JSON
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

async function loadEnv() {
  const p = path.join(ROOT, '.env.local');
  for (const line of (await readFile(p, 'utf8')).split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '');
  }
}
await loadEnv();

const id = process.argv[2];
if (!id) {
  console.error('Укажи node-id, например 1770:149873');
  process.exit(1);
}
if (!process.env.FIGMA_TOKEN) {
  console.error('Нет FIGMA_TOKEN в .env.local');
  process.exit(1);
}

const arg = (f, d) => {
  const i = process.argv.indexOf(f);
  return i === -1 ? d : process.argv[i + 1];
};

const apiId = id.replace('-', ':');
// /v1/files с ?ids= — возвращает ТОЛЬКО поддерево нужного узла (payload небольшой),
// и лимиты выше, чем у /nodes. Без depth — забираем всё поддерево целиком за один запрос.
const fetchDepth = arg('--fetch-depth', '');
const depthParam = fetchDepth ? `&depth=${fetchDepth}` : '';
const url = `https://api.figma.com/v1/files/${process.env.FIGMA_FILE_KEY}?ids=${encodeURIComponent(apiId)}${depthParam}`;

// Один запрос, без агрессивных ретраев — чтобы не «разогревать» окно лимита заново.
async function getWithRetry(u, tries = 2) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(u, { headers: { 'X-Figma-Token': process.env.FIGMA_TOKEN } });
    if (res.ok) return res.json();
    if (res.status === 429) {
      if (i === tries - 1) break;
      console.error(`429 rate limit, жду 90s… (попытка ${i + 1}/${tries})`);
      await new Promise((r) => setTimeout(r, 90000));
      continue;
    }
    console.error(`Figma ${res.status}: ${(await res.text()).slice(0, 300)}`);
    process.exit(1);
  }
  console.error('429: лимит ещё держится — нужно дать API дольше отдохнуть.');
  process.exit(1);
}

const data = await getWithRetry(url);
function findById(node) {
  if (node.id === apiId) return node;
  for (const c of node.children ?? []) {
    const hit = findById(c);
    if (hit) return hit;
  }
  return null;
}
const target = findById(data.document);
if (!target) {
  console.error(`Узел ${apiId} не найден в ответе (document).`);
  process.exit(1);
}

const box = (n) => {
  const b = n.absoluteBoundingBox;
  return b ? `${Math.round(b.width)}×${Math.round(b.height)}` : '';
};
const hx = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
const fill = (n) => {
  const f = (n.fills ?? []).find((x) => x.visible !== false && x.type === 'SOLID');
  if (!f) {
    const img = (n.fills ?? []).find((x) => x.type === 'IMAGE');
    if (img) return `img:${img.imageRef?.slice(0, 8)}`;
    const grad = (n.fills ?? []).find((x) => x.visible !== false && x.type?.startsWith('GRADIENT'));
    return grad ? 'gradient' : '';
  }
  const { r, g, b } = f.color;
  const a = f.opacity ?? f.color.a;
  const base = `#${hx(r)}${hx(g)}${hx(b)}`.toUpperCase();
  return a !== undefined && a < 1 ? `${base}/${Math.round(a * 100)}%` : base;
};
const layout = (n) => {
  const parts = [];
  if (n.layoutMode && n.layoutMode !== 'NONE') {
    parts.push(n.layoutMode === 'VERTICAL' ? 'col' : 'row');
    if (n.itemSpacing) parts.push(`gap${n.itemSpacing}`);
    const p = [n.paddingTop, n.paddingRight, n.paddingBottom, n.paddingLeft];
    if (p.some(Boolean)) parts.push(`p${p.map((v) => v ?? 0).join('/')}`);
    if (n.primaryAxisAlignItems) parts.push(`main:${n.primaryAxisAlignItems}`);
    if (n.counterAxisAlignItems) parts.push(`cross:${n.counterAxisAlignItems}`);
  }
  if (n.cornerRadius) parts.push(`r${n.cornerRadius}`);
  return parts.join(' ');
};

// Всегда сохраняем сырое поддерево — чтобы потом читать офлайн без API.
const dest = path.join(ROOT, 'design', 'raw', `node-${apiId.replace(':', '-')}.json`);
await mkdir(path.dirname(dest), { recursive: true });
await writeFile(dest, JSON.stringify(target, null, 2));
console.error(`[saved ${path.relative(ROOT, dest)}]`);

const maxDepth = Number(arg('--depth', 4));
console.log('=== СТРУКТУРА ===');
(function tree(n, d, indent) {
  const t = n.type === 'TEXT' ? ` «${n.characters?.slice(0, 50)}»` : '';
  console.log(`${indent}${n.name} [${n.type}] ${box(n)} ${fill(n)} ${layout(n)}${t}  ${n.id}`);
  if (d > 0) for (const c of n.children ?? []) tree(c, d - 1, indent + '  ');
})(target, maxDepth, '');

console.log('\n=== ТЕКСТЫ (по порядку сверху-вниз) ===');
const out = [];
(function walk(n) {
  if (n.type === 'TEXT' && n.characters?.trim()) {
    const s = n.style ?? {};
    const b = n.absoluteBoundingBox;
    out.push({
      y: Math.round(b?.y ?? 0),
      x: Math.round(b?.x ?? 0),
      size: s.fontSize,
      weight: s.fontWeight,
      font: s.fontFamily,
      color: fill(n),
      text: n.characters.replace(/\n/g, ' ⏎ '),
    });
  }
  for (const c of n.children ?? []) walk(c);
})(target);
out.sort((a, b) => a.y - b.y || a.x - b.x);
for (const t of out) {
  console.log(`[${t.font} ${t.size}/${t.weight} ${t.color}] ${t.text}`);
}
console.log(`\nвсего текстов: ${out.length}`);
