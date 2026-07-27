/**
 * Декодирует локальный .fig в JSON-дерево: `node scripts/fig-decode.mjs <файл.fig>`.
 *
 * Зачем не REST: файл огромный, /v1/files и /nodes стабильно отдают 429 даже на
 * depth=1. Выгруженный из Figma .fig читается целиком и офлайн.
 *
 * Формат: zip → canvas.fig = "fig-kiwi" + version(u32) + чанки [len(u32)+данные].
 * Чанк 0 — схема Kiwi (raw deflate), чанк 1 — документ (в свежих файлах zstd).
 * Схема лежит внутри файла, поэтому декодер не привязан к версии Figma.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { decodeBinarySchema } from 'kiwi-schema';
import { makeDecoder } from './fig-kiwi.mjs';

const src = process.argv[2];
if (!src) {
  console.error('использование: node scripts/fig-decode.mjs <файл.fig> [выход.json]');
  process.exit(1);
}
const outPath = process.argv[3] ?? 'design/raw/doc.json';

const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR ?? '/tmp', 'fig-'));
execFileSync('unzip', ['-o', '-q', path.resolve(src), '-d', tmp]);

const buf = fs.readFileSync(path.join(tmp, 'canvas.fig'));
if (buf.subarray(0, 8).toString('latin1') !== 'fig-kiwi') throw new Error('не похоже на canvas.fig');

const chunks = [];
let off = 12;
while (off + 4 <= buf.length) {
  const len = buf.readUInt32LE(off);
  off += 4;
  if (len === 0 || off + len > buf.length) break;
  const raw = buf.subarray(off, off + len);
  off += len;
  const isZstd = raw[0] === 0x28 && raw[1] === 0xb5 && raw[2] === 0x2f && raw[3] === 0xfd;
  let data;
  if (isZstd) data = zlib.zstdDecompressSync(raw, { maxOutputLength: 1 << 30 });
  else {
    try {
      data = zlib.inflateRawSync(raw);
    } catch {
      data = raw;
    }
  }
  chunks.push(data);
}

const schema = decodeBinarySchema(chunks[0]);
const { value } = makeDecoder(schema).decode(chunks[1], 'Message');

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(value));
fs.rmSync(tmp, { recursive: true, force: true });

console.error(`узлов: ${value.nodeChanges.length} → ${outPath}`);
