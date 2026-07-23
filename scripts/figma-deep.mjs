#!/usr/bin/env node
/**
 * Достаёт дерево макета через /v1/files (эндпоинт /nodes бывает в rate limit).
 *
 *   node scripts/figma-deep.mjs 12          # скачать дерево глубины 12
 *   node scripts/figma-deep.mjs 12 --find "landing"   # + найти узлы по имени
 *
 * Ответ пишется стримом — файл может быть в сотни мегабайт.
 */

import { readFile, mkdir, stat } from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const RAW = path.join(ROOT, 'design', 'raw');

async function loadEnv() {
  const p = path.join(ROOT, '.env.local');
  for (const line of (await readFile(p, 'utf8')).split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '');
  }
}

await loadEnv();

const depth = Number(process.argv[2] ?? 8);
const dest = path.join(RAW, `file-d${depth}.json`);
await mkdir(RAW, { recursive: true });

if (!existsSync(dest)) {
  console.log(`Качаю дерево глубины ${depth}…`);
  const res = await fetch(
    `https://api.figma.com/v1/files/${process.env.FIGMA_FILE_KEY}?depth=${depth}`,
    { headers: { 'X-Figma-Token': process.env.FIGMA_TOKEN } },
  );
  if (!res.ok) {
    console.error(`Figma ${res.status}: ${(await res.text()).slice(0, 200)}`);
    process.exit(1);
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

const { size } = await stat(dest);
console.log(`${path.relative(ROOT, dest)} — ${(size / 1048576).toFixed(1)} MB`);

// Индекс узлов: id → {name, type, size} — чтобы искать по имени без загрузки всего в память
const findIdx = process.argv.indexOf('--find');
if (findIdx !== -1) {
  const needle = (process.argv[findIdx + 1] ?? '').toLowerCase();
  const raw = await readFile(dest, 'utf8');
  const doc = JSON.parse(raw);

  const hits = [];
  (function walk(n, trail) {
    const name = n.name ?? '';
    if (name.toLowerCase().includes(needle)) {
      const b = n.absoluteBoundingBox;
      hits.push({
        id: n.id,
        name,
        type: n.type,
        size: b ? `${Math.round(b.width)}×${Math.round(b.height)}` : '',
        path: trail,
      });
    }
    for (const c of n.children ?? []) walk(c, `${trail} / ${name}`);
  })(doc.document, '');

  console.log(`\nНайдено: ${hits.length}`);
  for (const h of hits.slice(0, 40)) {
    console.log(`  ${h.id}  ${h.type.padEnd(12)} ${h.size.padEnd(12)} ${h.name}`);
  }
}
