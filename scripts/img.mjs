#!/usr/bin/env node
/**
 * Инструменты для работы с PNG-эталонами макета.
 *
 *   node scripts/img.mjs crop <in.png> <x> <y> <w> <h> <out.png>   # вырезать регион
 *   node scripts/img.mjs px <in.png> <x> <y> [x y ...]             # цвет пикселей
 *   node scripts/img.mjs size <in.png>                             # размеры
 *   node scripts/img.mjs diff <a.png> <b.png> <out.png>            # пиксельный дифф
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const [cmd, ...args] = process.argv.slice(2);

const load = (p) => PNG.sync.read(readFileSync(p));
const save = (p, png) => writeFileSync(p, PNG.sync.write(png));
const hex = (n) => n.toString(16).padStart(2, '0').toUpperCase();

switch (cmd) {
  case 'size': {
    const img = load(args[0]);
    console.log(`${img.width}x${img.height}`);
    break;
  }

  case 'px': {
    const img = load(args[0]);
    for (let i = 1; i + 1 < args.length + 1; i += 2) {
      const x = Number(args[i]);
      const y = Number(args[i + 1]);
      if (Number.isNaN(x) || Number.isNaN(y)) break;
      const idx = (img.width * y + x) << 2;
      const [r, g, b, a] = img.data.subarray(idx, idx + 4);
      console.log(`${x},${y}: #${hex(r)}${hex(g)}${hex(b)}${a !== 255 ? ' a=' + a : ''}`);
    }
    break;
  }

  case 'crop': {
    const [inPath, x, y, w, h, outPath] = args;
    const img = load(inPath);
    const X = Math.max(0, Number(x));
    const Y = Math.max(0, Number(y));
    const W = Math.min(Number(w), img.width - X);
    const H = Math.min(Number(h), img.height - Y);
    const out = new PNG({ width: W, height: H });
    PNG.bitblt(img, out, X, Y, W, H, 0, 0);
    save(outPath, out);
    console.log(`${outPath}: ${W}x${H} @ ${X},${Y}`);
    break;
  }

  case 'diff': {
    const [aPath, bPath, outPath] = args;
    const { default: pixelmatch } = await import('pixelmatch');
    const a = load(aPath);
    const b = load(bPath);
    if (a.width !== b.width || a.height !== b.height) {
      console.error(`Размеры не совпадают: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
      process.exit(2);
    }
    const out = new PNG({ width: a.width, height: a.height });
    const n = pixelmatch(a.data, b.data, out.data, a.width, a.height, { threshold: 0.1 });
    save(outPath, out);
    const pct = ((n / (a.width * a.height)) * 100).toFixed(2);
    console.log(`расходятся ${n} px (${pct}%)`);
    break;
  }

  default:
    console.error('Команды: crop | px | size | diff');
    process.exit(1);
}
