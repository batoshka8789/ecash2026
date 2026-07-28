/**
 * Массовая выгрузка спек из декодированного .fig в отдельные файлы,
 * чтобы агенты читали готовый текст, а не парсили 145 МБ JSON на каждый вопрос.
 *
 *   node --max-old-space-size=12288 scripts/fig-dump.mjs [outDir]
 *
 * Кладёт в <outDir> (по умолчанию design/raw/spec, он в .gitignore):
 *   index.md              — верхнеуровневые фреймы обеих страниц + их дети
 *   frames/<id>.txt       — глубокая спека верхнеуровневого фрейма (секции целиком)
 *   screens/<id>.txt      — глубокая спека отдельного экрана-брейкпоинта
 *
 * Секции-дубликаты `2003:*` со страницы Adaptives пропускаются: это копии.
 */
import fs from 'node:fs';
import path from 'node:path';
import { gid, childrenOf, effectiveChildren, describe, tree } from './fig-spec.mjs';

const outDir = process.argv[2] ?? 'design/raw/spec';
for (const d of ['frames', 'screens']) fs.mkdirSync(path.join(outDir, d), { recursive: true });

const PAGES = [
  ['Main', '268:11867'],
  ['Adaptives', '1279:97192'],
];

/** Копии оригинальных секций — в них те же экраны под безымянными номерами. */
const isDup = (id) => id.startsWith('2003:');

const fmt = (o) =>
  Object.entries(o)
    .filter(([k]) => k !== 'id' && k !== 'name' && k !== 'type')
    .map(([k, v]) => `${k}=${v}`)
    .join('  ');

const file = (id) => `${id.replace(':', '_')}.txt`;
const index = [];
let frames = 0;
let screens = 0;

const write = (dir, id, header, lines) =>
  fs.writeFileSync(path.join(outDir, dir, file(id)), `${header}\n\n${lines.join('\n')}\n`);

for (const [pageName, pageId] of PAGES) {
  index.push(`\n# Страница «${pageName}» [${pageId}]`);
  for (const top of childrenOf(pageId)) {
    const tid = gid(top.guid);
    if (isDup(tid)) continue;
    const d = describe(top);
    index.push(`\n## ${top.type} «${top.name}» [${tid}] ${d.size ?? ''}  → frames/${file(tid)}`);
    write(
      'frames',
      tid,
      `# ${top.type} «${top.name}» [${tid}]  ${fmt(d)}\n# страница: ${pageName}`,
      tree(tid, 40),
    );
    frames++;

    // Дети секции — экраны по брейкпоинтам; каждому свой файл.
    for (const kid of effectiveChildren(tid)) {
      const kid_id = gid(kid.guid);
      const kd = describe(kid);
      if (kid.type === 'CONNECTOR') continue;
      index.push(
        `  - ${kid.type} «${kid.name}» [${kid_id}] ${kd.size ?? ''}  → screens/${file(kid_id)}`,
      );
      write(
        'screens',
        kid_id,
        `# ${kid.type} «${kid.name}» [${kid_id}]  ${fmt(kd)}\n` +
          `# секция: «${top.name}» [${tid}] · страница: ${pageName}`,
        tree(kid_id, 40),
      );
      screens++;
    }
  }
}

fs.writeFileSync(path.join(outDir, 'index.md'), index.join('\n') + '\n');
console.log(`фреймов: ${frames}, экранов: ${screens} → ${outDir}`);
