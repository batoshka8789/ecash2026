#!/usr/bin/env node
/**
 * Выгружает макет ecash из Figma REST API.
 *
 *   node scripts/figma-pull.mjs                 # инвентарь страниц/экранов + PNG-эталоны
 *   node scripts/figma-pull.mjs --no-images     # только структура
 *   node scripts/figma-pull.mjs --frames <id..> # полные поддеревья конкретных фреймов
 *
 * Макет очень большой, поэтому файл НИКОГДА не тянется целиком:
 * сначала берётся мелкая структура (depth=2), а тяжёлые поддеревья
 * докачиваются по одному фрейму и пишутся стримом.
 *
 * Токен читается из .env.local и никогда не печатается в лог.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DESIGN = path.join(ROOT, 'design');
const RAW_DIR = path.join(DESIGN, 'raw');
const FRAMES_DIR = path.join(RAW_DIR, 'frames');
const SCREENS_DIR = path.join(DESIGN, 'screens');

// ---------------------------------------------------------------- env

async function loadEnv() {
  const envPath = path.join(ROOT, '.env.local');
  if (!existsSync(envPath)) fail('Не найден .env.local в корне проекта.');
  const raw = await readFile(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '');
  }
  if (!process.env.FIGMA_TOKEN) fail('В .env.local пустой FIGMA_TOKEN.');
  if (!process.env.FIGMA_FILE_KEY) fail('В .env.local нет FIGMA_FILE_KEY.');
}

function fail(msg) {
  console.error('\n❌ ' + msg + '\n');
  process.exit(1);
}

// ---------------------------------------------------------------- api

async function request(endpoint) {
  const res = await fetch('https://api.figma.com' + endpoint, {
    headers: { 'X-Figma-Token': process.env.FIGMA_TOKEN },
  });

  if (res.status === 403)
    fail(
      'Figma вернула 403 — токен неверный, отозван, без права file_content:read,\n' +
        'либо его аккаунт не видит этот файл.',
    );
  if (res.status === 404) fail('Файл не найден — проверь FIGMA_FILE_KEY.');
  if (res.status === 429) fail('Rate limit Figma. Подожди минуту и повтори.');
  if (!res.ok) fail(`Figma вернула ${res.status}: ${(await res.text()).slice(0, 300)}`);

  return res;
}

const api = async (endpoint) => (await request(endpoint)).json();

/** Пишет ответ на диск стримом — без строкового лимита V8. */
async function apiToFile(endpoint, dest) {
  const res = await request(endpoint);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

// ---------------------------------------------------------------- helpers

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'node';

const chunk = (arr, n) =>
  Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

const SCREEN_TYPES = ['FRAME', 'COMPONENT', 'COMPONENT_SET', 'SECTION', 'INSTANCE'];

function formFactor(w) {
  if (!w) return '—';
  if (w <= 480) return 'mobile';
  if (w <= 900) return 'tablet';
  return 'desktop';
}

// ---------------------------------------------------------------- structure

function collectScreens(document) {
  const pages = [];
  for (const page of document.children ?? []) {
    if (page.type !== 'CANVAS') continue;
    const frames = (page.children ?? [])
      .filter((n) => SCREEN_TYPES.includes(n.type))
      .map((n) => ({
        id: n.id,
        name: n.name,
        type: n.type,
        width: Math.round(n.absoluteBoundingBox?.width ?? 0),
        height: Math.round(n.absoluteBoundingBox?.height ?? 0),
      }))
      .sort((a, b) => b.width * b.height - a.width * a.height);
    pages.push({ id: page.id, name: page.name, frames });
  }
  return pages;
}

function renderInventory(pages, fileName, lastModified) {
  const total = pages.reduce((n, p) => n + p.frames.length, 0);
  const out = [
    `# Инвентарь макета — ${fileName}`,
    '',
    `Страниц: **${pages.length}** · Фреймов верхнего уровня: **${total}**`,
    `Макет изменён: ${lastModified}`,
    '',
    'Сгенерировано `npm run figma:structure`. Вручную не редактировать.',
    '',
  ];

  for (const page of pages) {
    out.push(`## ${page.name}  <sub>\`${page.id}\`</sub>`, '');
    if (!page.frames.length) {
      out.push('_пусто_', '');
      continue;
    }
    out.push('| Фрейм | node-id | Размер | Формат |', '| --- | --- | --- | --- |');
    for (const f of page.frames) {
      out.push(
        `| ${f.name.replace(/\|/g, '\\|')} | \`${f.id}\` | ${f.width}×${f.height} | ${formFactor(f.width)} |`,
      );
    }
    out.push('');
  }
  return out.join('\n');
}

// ---------------------------------------------------------------- images

async function pullImages(pages, key) {
  const targets = pages.flatMap((p) =>
    p.frames
      .filter((f) => f.width && f.height)
      .map((f) => ({ ...f, file: `${slug(p.name)}__${slug(f.name)}.png` })),
  );
  if (!targets.length) return;

  console.log(`\nРендерю ${targets.length} экранов…`);
  await mkdir(SCREENS_DIR, { recursive: true });

  let done = 0;
  let blocked = false;

  for (const group of chunk(targets, 10)) {
    const ids = group.map((t) => t.id).join(',');
    const data = await api(
      `/v1/images/${key}?ids=${encodeURIComponent(ids)}&format=png&scale=2`,
    );
    if (data.err) {
      console.warn(`   Figma: ${data.err}`);
      blocked = true;
      break;
    }

    await Promise.all(
      group.map(async (t) => {
        const url = data.images?.[t.id];
        if (!url) return;
        const res = await fetch(url);
        if (!res.ok) return;
        await pipeline(
          Readable.fromWeb(res.body),
          createWriteStream(path.join(SCREENS_DIR, t.file)),
        );
        done++;
        process.stdout.write(`\r   скачано ${done}/${targets.length}`);
      }),
    );
  }
  console.log('');

  if (blocked || done === 0) {
    console.warn(
      '\nЭкспорт картинок недоступен — вероятно владелец макета запретил\n' +
        'копирование/экспорт для зрителей. Структура прочитана нормально.',
    );
  } else {
    console.log(`Готово: design/screens/ (${done} шт.)`);
  }
}

// ---------------------------------------------------------------- frames

/** Полное поддерево фрейма — тяжёлое, поэтому строго по одному и стримом. */
async function pullFrames(ids, key) {
  await mkdir(FRAMES_DIR, { recursive: true });
  for (const id of ids) {
    const dest = path.join(FRAMES_DIR, `${id.replace(':', '-')}.json`);
    process.stdout.write(`   ${id} … `);
    await apiToFile(`/v1/files/${key}/nodes?ids=${encodeURIComponent(id)}`, dest);
    const size = (await readFile(dest)).length;
    console.log(`${(size / 1048576).toFixed(1)} MB`);
  }
  console.log(`\nПоддеревья: design/raw/frames/`);
}

// ---------------------------------------------------------------- main

async function main() {
  await loadEnv();
  const key = process.env.FIGMA_FILE_KEY;
  const argv = process.argv.slice(2);

  await mkdir(RAW_DIR, { recursive: true });

  const frameFlag = argv.indexOf('--frames');
  if (frameFlag !== -1) {
    const ids = argv.slice(frameFlag + 1).filter((a) => !a.startsWith('--'));
    if (!ids.length) fail('Укажи node-id: --frames 1770:149873 …');
    console.log('Качаю поддеревья фреймов…');
    return pullFrames(ids, key);
  }

  console.log('Читаю структуру макета (depth=2)…');
  const file = await api(`/v1/files/${key}?depth=2`);
  console.log(`Файл: "${file.name}" · изменён ${file.lastModified}`);

  const pages = collectScreens(file.document);
  await writeFile(path.join(RAW_DIR, 'inventory.json'), JSON.stringify(pages, null, 2));
  await writeFile(
    path.join(DESIGN, 'inventory.md'),
    renderInventory(pages, file.name, file.lastModified),
  );

  const total = pages.reduce((n, p) => n + p.frames.length, 0);
  console.log(`Инвентарь: design/inventory.md — ${pages.length} страниц, ${total} фреймов`);

  if (!argv.includes('--no-images')) await pullImages(pages, key);
}

main().catch((e) => fail(e.stack ?? String(e)));
