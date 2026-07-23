#!/usr/bin/env node
/**
 * Рендерит конкретные узлы макета в PNG/SVG — эталоны для сверки вёрстки.
 *
 *   node scripts/figma-render.mjs 1279:104497 1279:104507
 *   node scripts/figma-render.mjs --scale 1 --out landing 2153:195405
 *   node scripts/figma-render.mjs --format svg 1151:67561
 *
 * Имена файлов берутся из макета, так что эталон легко сопоставить с экраном.
 */

import { readFile, mkdir } from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

async function loadEnv() {
  const envPath = path.join(ROOT, '.env.local');
  if (!existsSync(envPath)) throw new Error('Нет .env.local');
  for (const line of (await readFile(envPath, 'utf8')).split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '');
  }
}

const arg = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? dflt : process.argv[i + 1];
};

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'node';

const chunk = (arr, n) =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

const FLAGS = ['--scale', '--out', '--format'];
const ids = process.argv.slice(2).filter((a, i, all) => {
  if (a.startsWith('--')) return false;
  return !FLAGS.includes(all[i - 1]);
});

if (!ids.length) {
  console.error('Укажи node-id, например: node scripts/figma-render.mjs 1279:104497');
  process.exit(1);
}

const scale = arg('--scale', '2');
const format = arg('--format', 'png');
const outDir = path.join(ROOT, 'design', 'screens', arg('--out', ''));

await loadEnv();
const key = process.env.FIGMA_FILE_KEY;
const headers = { 'X-Figma-Token': process.env.FIGMA_TOKEN };

// имена и размеры узлов — для осмысленных имён файлов
const meta = {};
for (const group of chunk(ids, 40)) {
  const res = await fetch(
    `https://api.figma.com/v1/files/${key}/nodes?ids=${encodeURIComponent(group.join(','))}&depth=1`,
    { headers },
  );
  const data = await res.json();
  for (const id of group) {
    const d = data.nodes?.[id]?.document;
    if (d) {
      const b = d.absoluteBoundingBox;
      meta[id] = { name: d.name, w: Math.round(b?.width ?? 0), h: Math.round(b?.height ?? 0) };
    }
  }
}

await mkdir(outDir, { recursive: true });
console.log(`Рендерю ${ids.length} узлов (${format}, scale ${scale})…`);

let done = 0;
for (const group of chunk(ids, 8)) {
  const res = await fetch(
    `https://api.figma.com/v1/images/${key}` +
      `?ids=${encodeURIComponent(group.join(','))}&format=${format}&scale=${scale}`,
    { headers },
  );
  const data = await res.json();

  if (data.err) {
    console.error(`Figma: ${data.err}`);
    process.exit(1);
  }

  await Promise.all(
    group.map(async (id) => {
      const url = data.images?.[id];
      const m = meta[id] ?? { name: id, w: 0, h: 0 };
      if (!url) {
        console.warn(`   пропуск ${id} (${m.name}) — Figma не отдала рендер`);
        return;
      }
      const img = await fetch(url);
      if (!img.ok) return;
      const file = `${m.w}__${slug(m.name)}__${id.replace(':', '-')}.${format}`;
      await pipeline(Readable.fromWeb(img.body), createWriteStream(path.join(outDir, file)));
      done++;
      console.log(`   ✓ ${file}`);
    }),
  );
}

console.log(`\nГотово: ${done}/${ids.length} → ${path.relative(ROOT, outDir)}`);
