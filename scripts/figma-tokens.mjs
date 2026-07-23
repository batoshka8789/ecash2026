#!/usr/bin/env node
/**
 * Извлекает дизайн-токены из палитр, задокументированных в самом макете.
 *
 *   node scripts/figma-tokens.mjs
 *
 * В макете есть фреймы «pallete surface / font / btns / stroke / divider»,
 * где каждая строка — это пара «имя токена → HEX», отдельно для Dark и Light.
 * Скрипт читает их и генерирует:
 *   design/tokens.json   — машинный вид, для сверки
 *   src/app/tokens.css   — переменные + @theme для Tailwind v4
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const FRAMES_DIR = path.join(ROOT, 'design', 'raw', 'frames');

/** Палитры в макете: node-id → префикс токена. */
const PALETTES = [
  { id: '1854:79951', prefix: 'surface' },
  { id: '1852:146197', prefix: 'text' },
  { id: '1854:80671', prefix: 'btn' },
  { id: '1854:80365', prefix: 'stroke' },
  { id: '1854:80805', prefix: 'divider' },
];

// ---------------------------------------------------------------- env / api

async function loadEnv() {
  const envPath = path.join(ROOT, '.env.local');
  if (!existsSync(envPath)) throw new Error('Нет .env.local');
  for (const line of (await readFile(envPath, 'utf8')).split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '');
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Figma легко отдаёт 429, поэтому ретраим с нарастающей паузой. */
async function frameJson(id) {
  const dest = path.join(FRAMES_DIR, `${id.replace(':', '-')}.json`);
  if (existsSync(dest)) return JSON.parse(await readFile(dest, 'utf8'));

  const url =
    `https://api.figma.com/v1/files/${process.env.FIGMA_FILE_KEY}` +
    `/nodes?ids=${encodeURIComponent(id)}`;

  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(url, { headers: { 'X-Figma-Token': process.env.FIGMA_TOKEN } });

    if (res.status === 429) {
      const wait = Number(res.headers.get('retry-after')) * 1000 || attempt * 20_000;
      console.log(`   429 — жду ${Math.round(wait / 1000)}с и повторяю (${attempt}/5)…`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`Figma ${res.status} на узле ${id}`);

    const data = await res.json();
    await mkdir(FRAMES_DIR, { recursive: true });
    await writeFile(dest, JSON.stringify(data, null, 2));
    return data;
  }
  throw new Error(`Figma держит rate limit на узле ${id}. Повтори через пару минут.`);
}

// ---------------------------------------------------------------- parsing

const IS_HEX = /^#?[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;

function textNodes(node, acc = []) {
  if (node.type === 'TEXT' && node.absoluteBoundingBox) {
    acc.push({
      text: node.characters.trim(),
      x: Math.round(node.absoluteBoundingBox.x),
      y: Math.round(node.absoluteBoundingBox.y),
    });
  }
  for (const child of node.children ?? []) textNodes(child, acc);
  return acc;
}

const kebab = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * Строки палитры: группируем текст по вертикали, внутри строки
 * ищем пары «имя → hex» слева (Dark) и справа (Light).
 */
function parsePalette(doc, prefix) {
  const texts = textNodes(doc);
  const light = texts.find((t) => t.text === 'Light');
  const splitX = light ? light.x - 40 : Infinity;

  // группировка по строкам с допуском на разную высоту шрифта
  const rows = new Map();
  for (const t of texts) {
    if (['Dark', 'Light'].includes(t.text)) continue;
    const key = [...rows.keys()].find((k) => Math.abs(k - t.y) <= 12) ?? t.y;
    (rows.get(key) ?? rows.set(key, []).get(key)).push(t);
  }

  const tokens = [];
  for (const [, row] of [...rows].sort((a, b) => a[0] - b[0])) {
    for (const side of ['dark', 'light']) {
      const cells = row
        .filter((t) => (side === 'dark' ? t.x < splitX : t.x >= splitX))
        .sort((a, b) => a.x - b.x);
      const hexCell = cells.find((c) => IS_HEX.test(c.text));
      const nameCell = cells.find((c) => !IS_HEX.test(c.text));
      if (!hexCell || !nameCell) continue;

      const name = `${prefix}-${kebab(nameCell.text)}`;
      let token = tokens.find((t) => t.name === name);
      if (!token) tokens.push((token = { name, dark: null, light: null }));
      token[side] = '#' + hexCell.text.replace('#', '').toUpperCase();
    }
  }
  return tokens;
}

// ---------------------------------------------------------------- output

function renderCss(tokens) {
  const varLines = (theme) =>
    tokens
      .filter((t) => t[theme])
      .map((t) => `  --${t.name}: ${t[theme]};`)
      .join('\n');

  return `/* Дизайн-токены ecash.
 * Сгенерировано \`npm run figma:tokens\` из палитр макета. Вручную не править —
 * правки затрутся при следующей выгрузке. Меняй макет и перегенерируй.
 */

@theme inline {
${tokens.map((t) => `  --color-${t.name}: var(--${t.name});`).join('\n')}
}

/* Тёмная тема — основная в макете */
:root {
${varLines('dark')}
}

:root[data-theme='light'] {
${varLines('light')}
}
`;
}

// ---------------------------------------------------------------- main

await loadEnv();

const all = [];
for (const { id, prefix } of PALETTES) {
  const data = await frameJson(id);
  const doc = data.nodes?.[id]?.document;
  if (!doc) {
    console.warn(`   пропуск ${id} — узел не найден`);
    continue;
  }
  const tokens = parsePalette(doc, prefix);
  console.log(`   ${doc.name}: ${tokens.length} токенов`);
  all.push(...tokens);
}

if (!all.length) {
  console.error('Не удалось извлечь ни одного токена.');
  process.exit(1);
}

await writeFile(
  path.join(ROOT, 'design', 'tokens.json'),
  JSON.stringify(all, null, 2),
);
await mkdir(path.join(ROOT, 'src', 'app'), { recursive: true });
await writeFile(path.join(ROOT, 'src', 'app', 'tokens.css'), renderCss(all));

const missing = all.filter((t) => !t.dark || !t.light);
console.log(`\nВсего токенов: ${all.length} → src/app/tokens.css`);
if (missing.length) {
  console.log(`Без пары тем (${missing.length}): ${missing.map((t) => t.name).join(', ')}`);
}
