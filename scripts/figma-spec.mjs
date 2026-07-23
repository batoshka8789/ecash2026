#!/usr/bin/env node
/**
 * Точные спеки узлов макета — источник правды для вёрстки 1:1.
 * Работает офлайн по дампу design/raw/file-d16.json (обрезанных узлов нет).
 *
 *   node scripts/figma-spec.mjs 1279:104497                # дерево со спеками
 *   node scripts/figma-spec.mjs 1279:104497 --depth 3      # ограничить вывод
 *   node scripts/figma-spec.mjs 1279:104497 --text         # только тексты
 *   node scripts/figma-spec.mjs --screens                  # карта всех экранов
 *   node scripts/figma-spec.mjs --find "калькулятор"       # поиск по имени/тексту
 *
 * Запускать с увеличенной кучей: node --max-old-space-size=12288
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DUMP = [16, 10, 6]
  .map((d) => path.join(ROOT, 'design', 'raw', `file-d${d}.json`))
  .find((p) => existsSync(p));

if (!DUMP) {
  console.error('Нет дампа design/raw/file-dN.json — сначала scripts/figma-deep.mjs');
  process.exit(1);
}

const doc = JSON.parse(await readFile(DUMP, 'utf8'));

// ---------------------------------------------------------------- формат

const round = (v) => (v === undefined ? undefined : Math.round(v * 100) / 100);

const hex = (c) => {
  if (!c) return '';
  const h = (v) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  const base = `#${h(c.r)}${h(c.g)}${h(c.b)}`.toUpperCase();
  return c.a !== undefined && c.a < 1 ? `${base}/${Math.round(c.a * 100)}%` : base;
};

function paint(p) {
  if (!p || p.visible === false) return '';
  if (p.type === 'SOLID') {
    const c = hex(p.color);
    return p.opacity !== undefined && p.opacity < 1 ? `${c}·${Math.round(p.opacity * 100)}%` : c;
  }
  if (p.type === 'IMAGE') return `image(${p.imageRef?.slice(0, 8)})`;
  if (p.type?.startsWith('GRADIENT')) {
    return `${p.type.replace('GRADIENT_', '').toLowerCase()}(${(p.gradientStops ?? [])
      .map((s) => hex(s.color))
      .join('→')})`;
  }
  return p.type;
}

const paints = (arr) => (arr ?? []).map(paint).filter(Boolean).join(' ');

/** Радиусы: один общий или четыре по углам. */
function radius(n) {
  if (Array.isArray(n.rectangleCornerRadii)) {
    const [a, b, c, d] = n.rectangleCornerRadii;
    return a === b && b === c && c === d ? `r${round(a)}` : `r${[a, b, c, d].map(round).join('/')}`;
  }
  return n.cornerRadius ? `r${round(n.cornerRadius)}` : '';
}

/** Автолэйаут: направление, gap, паддинги, выравнивание, режим размеров. */
function autolayout(n) {
  if (!n.layoutMode || n.layoutMode === 'NONE') return '';
  const parts = [n.layoutMode === 'VERTICAL' ? 'col' : 'row'];
  if (n.layoutWrap === 'WRAP') parts.push('wrap');
  if (n.itemSpacing) parts.push(`gap:${round(n.itemSpacing)}`);
  const [t, r, b, l] = [n.paddingTop, n.paddingRight, n.paddingBottom, n.paddingLeft].map(
    (v) => round(v) ?? 0,
  );
  if (t || r || b || l) {
    parts.push(t === b && r === l ? (t === r ? `p:${t}` : `p:${t}/${r}`) : `p:${t}/${r}/${b}/${l}`);
  }
  const jm = { MIN: 'start', CENTER: 'center', MAX: 'end', SPACE_BETWEEN: 'between' };
  if (n.primaryAxisAlignItems && n.primaryAxisAlignItems !== 'MIN')
    parts.push(`main:${jm[n.primaryAxisAlignItems] ?? n.primaryAxisAlignItems}`);
  if (n.counterAxisAlignItems && n.counterAxisAlignItems !== 'MIN')
    parts.push(`cross:${jm[n.counterAxisAlignItems] ?? n.counterAxisAlignItems}`);
  if (n.primaryAxisSizingMode === 'AUTO') parts.push('hug-main');
  if (n.counterAxisSizingMode === 'AUTO') parts.push('hug-cross');
  return parts.join(' ');
}

/** Как ребёнок ведёт себя внутри автолэйаута родителя. */
function childLayout(n) {
  const parts = [];
  if (n.layoutGrow) parts.push('grow');
  if (n.layoutAlign === 'STRETCH') parts.push('stretch');
  if (n.layoutSizingHorizontal === 'FILL') parts.push('fill-x');
  if (n.layoutSizingVertical === 'FILL') parts.push('fill-y');
  if (n.layoutSizingHorizontal === 'HUG') parts.push('hug-x');
  return parts.join(' ');
}

function typography(n) {
  const s = n.style;
  if (!s) return '';
  const bits = [`${round(s.fontSize)}/${s.fontWeight}`];
  if (s.lineHeightPx) bits.push(`lh${round(s.lineHeightPx)}`);
  if (s.letterSpacing) bits.push(`ls${round(s.letterSpacing)}`);
  if (s.textAlignHorizontal && s.textAlignHorizontal !== 'LEFT')
    bits.push(s.textAlignHorizontal.toLowerCase());
  if (s.fontFamily && s.fontFamily !== 'Roboto') bits.push(s.fontFamily);
  return bits.join(' ');
}

function effects(n) {
  return (n.effects ?? [])
    .filter((e) => e.visible !== false)
    .map((e) => {
      if (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') {
        const inner = e.type === 'INNER_SHADOW' ? 'inset ' : '';
        return `shadow(${inner}${round(e.offset?.x)},${round(e.offset?.y)} blur${round(e.radius)}${
          e.spread ? ` spread${round(e.spread)}` : ''
        } ${hex(e.color)})`;
      }
      if (e.type === 'LAYER_BLUR') return `blur(${round(e.radius)})`;
      if (e.type === 'BACKGROUND_BLUR') return `backdrop-blur(${round(e.radius)})`;
      return e.type;
    })
    .join(' ');
}

function stroke(n) {
  const s = paints(n.strokes);
  if (!s) return '';
  const w = n.strokeWeight ? round(n.strokeWeight) : 1;
  const align = n.strokeAlign && n.strokeAlign !== 'INSIDE' ? ` ${n.strokeAlign.toLowerCase()}` : '';
  return `border:${w}px ${s}${align}`;
}

/** Одна строка спеки узла. */
function spec(n, parentBox) {
  const b = n.absoluteBoundingBox;
  const bits = [];

  if (b) {
    bits.push(`${round(b.width)}×${round(b.height)}`);
    if (parentBox) {
      const dx = round(b.x - parentBox.x);
      const dy = round(b.y - parentBox.y);
      if (dx || dy) bits.push(`@${dx},${dy}`);
    }
  }

  const push = (v) => v && bits.push(v);
  push(autolayout(n));
  push(childLayout(n));
  push(paints(n.fills) && `fill:${paints(n.fills)}`);
  push(stroke(n));
  push(radius(n));
  push(effects(n));
  push(typography(n));
  if (n.opacity !== undefined && n.opacity < 1) push(`opacity:${round(n.opacity)}`);
  if (n.clipsContent) push('clip');

  return bits.join('  ');
}

// ---------------------------------------------------------------- обход

function find(node, id) {
  if (node.id === id) return node;
  for (const c of node.children ?? []) {
    const hit = find(c, id);
    if (hit) return hit;
  }
  return null;
}

const arg = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? dflt : process.argv[i + 1];
};

// ---------------------------------------------------------------- режимы

if (process.argv.includes('--screens')) {
  // Экраны = фреймы, чьё имя — ширина брейкпоинта, либо явные экраны секций
  const BP = new Set(['1920', '1024', '768', '480', '360']);
  for (const page of doc.document.children ?? []) {
    console.log(`\n═══ ${page.name}  ${page.id}`);
    for (const sec of page.children ?? []) {
      const kids = (sec.children ?? []).filter((c) =>
        ['FRAME', 'COMPONENT', 'INSTANCE'].includes(c.type),
      );
      if (!kids.length) continue;
      console.log(`\n── ${sec.name}  ${sec.id}  (${sec.type})`);
      for (const f of kids) {
        const b = f.absoluteBoundingBox;
        const w = String(Math.round(b?.width ?? 0));
        const tag = BP.has(w) || BP.has(f.name.trim()) ? '●' : ' ';
        console.log(
          `   ${tag} ${f.id.padEnd(14)} ${String(w).padStart(5)}×${String(
            Math.round(b?.height ?? 0),
          ).padEnd(6)} ${f.name}`,
        );
      }
    }
  }
  process.exit(0);
}

if (process.argv.includes('--find')) {
  const needle = arg('--find', '').toLowerCase();
  const hits = [];
  (function walk(n, trail) {
    const hay = `${n.name} ${n.characters ?? ''}`.toLowerCase();
    if (hay.includes(needle)) {
      const b = n.absoluteBoundingBox;
      hits.push({
        id: n.id,
        type: n.type,
        size: b ? `${Math.round(b.width)}×${Math.round(b.height)}` : '',
        name: n.name,
        text: n.characters?.slice(0, 50) ?? '',
        trail,
      });
    }
    for (const c of n.children ?? []) walk(c, `${trail}/${n.name}`);
  })(doc.document, '');
  console.log(`Найдено: ${hits.length}`);
  for (const h of hits.slice(0, 60)) {
    console.log(
      `${h.id.padEnd(15)} ${h.type.padEnd(11)} ${h.size.padEnd(12)} ${h.name}${
        h.text ? ` «${h.text}»` : ''
      }`,
    );
  }
  process.exit(0);
}

const id = process.argv[2];
if (!id || id.startsWith('--')) {
  console.error('Укажи node-id, либо --screens / --find <строка>');
  process.exit(1);
}

const target = find(doc.document, id);
if (!target) {
  console.error(`Узел ${id} не найден`);
  process.exit(1);
}

if (process.argv.includes('--text')) {
  const out = [];
  (function walk(n) {
    if (n.type === 'TEXT' && n.characters?.trim()) {
      const b = n.absoluteBoundingBox;
      out.push({
        y: Math.round(b?.y ?? 0),
        x: Math.round(b?.x ?? 0),
        spec: `${typography(n)} ${paints(n.fills)}`,
        text: n.characters.replace(/\n/g, ' ⏎ '),
      });
    }
    for (const c of n.children ?? []) walk(c);
  })(target);
  out.sort((a, b) => a.y - b.y || a.x - b.x);
  for (const t of out) console.log(`[${t.spec}] ${t.text}`);
  console.log(`\nвсего: ${out.length}`);
  process.exit(0);
}

const maxDepth = Number(arg('--depth', 6));
(function tree(n, d, indent, parentBox) {
  const label = n.type === 'TEXT' ? `«${n.characters?.slice(0, 45).replace(/\n/g, '⏎')}»` : n.name;
  console.log(`${indent}${label}  [${n.type}]  ${spec(n, parentBox)}  ${n.id}`);
  if (d > 0) for (const c of n.children ?? []) tree(c, d - 1, `${indent}  `, n.absoluteBoundingBox);
})(target, maxDepth, '', null);
