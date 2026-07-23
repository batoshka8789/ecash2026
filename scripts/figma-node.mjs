#!/usr/bin/env node
/**
 * Вытаскивает поддерево конкретного узла из большого дампа file-dN.json
 * и печатает его как дерево с текстом, размерами и стилями.
 *
 *   node scripts/figma-node.mjs 2153:195405            # структура
 *   node scripts/figma-node.mjs 2153:195405 --text     # только тексты по порядку
 *   node scripts/figma-node.mjs 2153:195405 --save     # сохранить поддерево в JSON
 *   node scripts/figma-node.mjs 2153:195405 --depth 4  # ограничить вывод
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const RAW = path.join(ROOT, 'design', 'raw');

const id = process.argv[2];
if (!id) {
  console.error('Укажи node-id, например 2153:195405');
  process.exit(1);
}

const arg = (f, d) => {
  const i = process.argv.indexOf(f);
  return i === -1 ? d : process.argv[i + 1];
};

// самый глубокий из скачанных дампов
const dumps = [16, 14, 12, 10, 8, 6]
  .map((d) => path.join(RAW, `file-d${d}.json`))
  .filter((p) => existsSync(p));
if (!dumps.length) {
  console.error('Нет дампов design/raw/file-dN.json — сначала scripts/figma-deep.mjs');
  process.exit(1);
}

const doc = JSON.parse(await readFile(dumps[0], 'utf8'));

function find(node) {
  if (node.id === id) return node;
  for (const c of node.children ?? []) {
    const hit = find(c);
    if (hit) return hit;
  }
  return null;
}

const target = find(doc.document);
if (!target) {
  console.error(`Узел ${id} не найден в ${path.basename(dumps[0])}`);
  process.exit(1);
}

const box = (n) => {
  const b = n.absoluteBoundingBox;
  return b ? `${Math.round(b.width)}×${Math.round(b.height)}` : '';
};

const fill = (n) => {
  const f = (n.fills ?? []).find((x) => x.visible !== false && x.type === 'SOLID');
  if (!f) {
    const img = (n.fills ?? []).find((x) => x.type === 'IMAGE');
    return img ? `img:${img.imageRef?.slice(0, 8)}` : '';
  }
  const { r, g, b } = f.color;
  const hex = (v) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase();
};

const layout = (n) => {
  const parts = [];
  if (n.layoutMode && n.layoutMode !== 'NONE') {
    parts.push(n.layoutMode === 'VERTICAL' ? 'col' : 'row');
    if (n.itemSpacing) parts.push(`gap${n.itemSpacing}`);
    const p = [n.paddingTop, n.paddingRight, n.paddingBottom, n.paddingLeft];
    if (p.some(Boolean)) parts.push(`p${p.map((v) => v ?? 0).join('/')}`);
  }
  if (n.cornerRadius) parts.push(`r${n.cornerRadius}`);
  return parts.join(' ');
};

if (process.argv.includes('--text')) {
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
        color: fill(n),
        text: n.characters.replace(/\n/g, ' ⏎ '),
      });
    }
    for (const c of n.children ?? []) walk(c);
  })(target);

  out.sort((a, b) => a.y - b.y || a.x - b.x);
  for (const t of out) {
    console.log(`[y${t.y} ${t.size}/${t.weight} ${t.color}] ${t.text}`);
  }
  console.log(`\nвсего текстов: ${out.length}`);
} else if (process.argv.includes('--save')) {
  const dest = path.join(RAW, `node-${id.replace(':', '-')}.json`);
  await writeFile(dest, JSON.stringify(target, null, 2));
  console.log(`Сохранено: ${path.relative(ROOT, dest)}`);
} else {
  const maxDepth = Number(arg('--depth', 4));
  (function tree(n, d, indent) {
    const t = n.type === 'TEXT' ? ` «${n.characters?.slice(0, 40)}»` : '';
    console.log(
      `${indent}${n.name} [${n.type}] ${box(n)} ${fill(n)} ${layout(n)}${t}  ${n.id}`,
    );
    if (d > 0) for (const c of n.children ?? []) tree(c, d - 1, indent + '  ');
  })(target, maxDepth, '');
}
