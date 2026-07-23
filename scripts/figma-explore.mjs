#!/usr/bin/env node
/**
 * Показывает дерево узлов внутри фрейма — чтобы найти реальные экраны
 * внутри больших досок макета.
 *
 *   node scripts/figma-explore.mjs 1404:107477          # depth 2
 *   node scripts/figma-explore.mjs 1404:107477 3        # depth 3
 *   node scripts/figma-explore.mjs 1404:107477 2 --json # + сохранить JSON
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
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

const box = (n) => {
  const b = n.absoluteBoundingBox;
  return b ? `${Math.round(b.width)}×${Math.round(b.height)}` : '';
};

function tree(node, depth, indent = '') {
  const lines = [`${indent}${node.name}  [${node.type}] ${box(node)}  ${node.id}`];
  if (depth > 0) {
    for (const child of node.children ?? []) {
      lines.push(...tree(child, depth - 1, indent + '  '));
    }
  }
  return lines;
}

const [id, depthArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!id) {
  console.error('Укажи node-id, например: node scripts/figma-explore.mjs 1404:107477');
  process.exit(1);
}
const depth = Number(depthArg ?? 2);

await loadEnv();

const res = await fetch(
  `https://api.figma.com/v1/files/${process.env.FIGMA_FILE_KEY}/nodes` +
    `?ids=${encodeURIComponent(id)}&depth=${depth}`,
  { headers: { 'X-Figma-Token': process.env.FIGMA_TOKEN } },
);
if (!res.ok) {
  console.error(`Figma ${res.status}: ${(await res.text()).slice(0, 200)}`);
  process.exit(1);
}

const data = await res.json();
const doc = data.nodes?.[id]?.document ?? data.nodes?.[id.replace('-', ':')]?.document;
if (!doc) {
  console.error('Узел не найден: ' + id);
  process.exit(1);
}

console.log(tree(doc, depth).join('\n'));

if (process.argv.includes('--json')) {
  const dir = path.join(ROOT, 'design', 'raw', 'frames');
  await mkdir(dir, { recursive: true });
  const dest = path.join(dir, `${id.replace(':', '-')}.json`);
  await writeFile(dest, JSON.stringify(data, null, 2));
  console.log(`\nСохранено: ${path.relative(ROOT, dest)}`);
}
