/**
 * Спека узла с РАЗРЕШЁННЫМИ переопределениями инстансов.
 *
 * Зачем отдельно от fig-spec.mjs: у INSTANCE в .fig нет собственных детей —
 * содержимое лежит в мастер-компоненте. `fig-spec.mjs` проваливается в мастер
 * как есть, поэтому для каждого брейкпоинта печатает ОДНУ И ТУ ЖЕ мастер-геометрию.
 * Например карточки действий на 1024 он показывает как 224×142 на x=0,244,488,…,
 * тогда как на самом деле там 179.2×142 на x=0,199.2,398.4,… — карточки растянуты
 * по ширине колонки 976. Сверять вёрстку по таким числам нельзя.
 *
 * Фактические значения Figma хранит в двух местах внутри самого инстанса:
 *   symbolData.symbolOverrides — авторские переопределения (padding, gap, текст, …)
 *   derivedSymbolData          — посчитанная раскладка (size, transform, размер текста)
 * Оба адресуют вложенные узлы через guidPath.
 *
 * Семантика guidPath (проверена по документу): путь растёт ТОЛЬКО при пересечении
 * границы инстанса. Обычные фреймы внутри мастера в путь не попадают:
 *   «Indicator container» [872:40761] — ребёнок мастера booking, путь 872:39176/872:40761
 *   «a-button-main» [872:38864] — ребёнок этого фрейма, путь всё равно 872:39176/872:38864
 *
 * Приоритет: свойства мастера ← переопределения вложенных инстансов ←
 * переопределения внешних. Самый внешний инстанс выигрывает: его derivedSymbolData —
 * это итог, посчитанный Figma со всеми учтёнными переопределениями.
 *
 *   node --max-old-space-size=8192 scripts/fig-resolve.mjs <node-id> [--depth N] [--text]
 *   node --max-old-space-size=8192 scripts/fig-resolve.mjs dump      — все экраны главной
 */
import fs from 'node:fs';
import path from 'node:path';

const DOC = process.env.FIG_DOC ?? 'design/raw/doc.json';
const raw = JSON.parse(fs.readFileSync(DOC, 'utf8'));

const gid = (g) => (g ? `${g.sessionID}:${g.localID}` : null);
const byId = new Map();
for (const n of raw.nodeChanges) byId.set(gid(n.guid), n);

const kids = new Map();
for (const n of raw.nodeChanges) {
  const p = n.parentIndex?.guid ? gid(n.parentIndex.guid) : null;
  if (!p) continue;
  if (!kids.has(p)) kids.set(p, []);
  kids.get(p).push(n);
}
for (const arr of kids.values())
  arr.sort((a, b) => {
    const x = a.parentIndex?.position ?? '';
    const y = b.parentIndex?.position ?? '';
    return x < y ? -1 : x > y ? 1 : 0;
  });

/* ─── контекст инстанса ─────────────────────────────────────────── */

const pathKey = (arr) => arr.join('/');

/** Карты переопределений одного инстанса, ключ — guidPath относительно него. */
function makeCtx(node) {
  const ovr = new Map();
  const der = new Map();
  for (const e of node.symbolData?.symbolOverrides ?? []) {
    const k = pathKey((e.guidPath?.guids ?? []).map(gid));
    ovr.set(k, { ...(ovr.get(k) ?? {}), ...e });
  }
  for (const e of node.derivedSymbolData ?? []) {
    const k = pathKey((e.guidPath?.guids ?? []).map(gid));
    der.set(k, { ...(der.get(k) ?? {}), ...e });
  }
  return { ovr, der, path: [] };
}

/**
 * Свойства узла с наложенными переопределениями всех активных инстансов.
 * Идём от внутреннего к внешнему, чтобы внешний перекрывал: его derivedSymbolData
 * посчитан последним и учитывает всё остальное.
 */
function resolveProps(node, id, ctxs) {
  let out = node;
  const applied = [];
  for (let i = ctxs.length - 1; i >= 0; i--) {
    const c = ctxs[i];
    const key = pathKey([...c.path, id]);
    const o = c.ovr.get(key);
    const d = c.der.get(key);
    if (o) {
      out = { ...out, ...o };
      applied.push('ovr');
    }
    if (d) {
      out = { ...out, ...d };
      applied.push('der');
      // Итоговый размер текстового слоя Figma кладёт отдельным полем.
      if (d.derivedTextData?.layoutSize && !d.size) out = { ...out, size: d.derivedTextData.layoutSize };
    }
  }
  return { node: out, resolved: applied.length > 0 };
}

/* ─── форматирование (совместимо с fig-spec.mjs) ────────────────── */

const ch = (v) => Math.round((v ?? 0) * 255);
function hex(c) {
  if (!c) return null;
  const s = `#${[ch(c.r), ch(c.g), ch(c.b)].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
  return c.a === undefined || c.a >= 0.999
    ? s.toUpperCase()
    : `${s.toUpperCase()} ${+(c.a * 100).toFixed(1)}%`;
}
function paint(p) {
  if (!p || p.visible === false) return null;
  const op = p.opacity !== undefined && p.opacity < 0.999 ? ` op=${+(p.opacity * 100).toFixed(1)}%` : '';
  if (p.type === 'SOLID') return `${hex(p.color)}${op}`;
  if (p.type?.startsWith('GRADIENT')) {
    const stops = (p.stops ?? []).map((s) => `${hex(s.color)}@${+(s.position * 100).toFixed(0)}%`).join(', ');
    return `${p.type}(${stops})${op}`;
  }
  if (p.type === 'IMAGE') {
    const h = p.image?.hash;
    const hs = h?.type === 'Buffer' ? Buffer.from(h.data).toString('hex') : (h ?? '?');
    return `IMAGE(${hs} ${p.imageScaleMode ?? ''})${op}`;
  }
  return `${p.type}${op}`;
}
const paints = (arr) => (arr ?? []).map(paint).filter(Boolean).join(' | ') || null;

function effect(e) {
  if (!e || e.visible === false) return null;
  const o = e.offset ?? { x: 0, y: 0 };
  if (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW')
    return `${e.type === 'INNER_SHADOW' ? 'inset ' : ''}${o.x}px ${o.y}px ${e.radius ?? 0}px ${e.spread ?? 0}px ${hex(e.color)}`;
  if (e.type === 'FOREGROUND_BLUR' || e.type === 'LAYER_BLUR') return `blur(${e.radius}px)`;
  if (e.type === 'BACKGROUND_BLUR') return `backdrop-blur(${e.radius}px)`;
  return `${e.type}(${e.radius ?? ''})`;
}

const num = (v) => (typeof v === 'number' ? +v.toFixed(2) : v);

function describe(n) {
  const o = {};
  if (n.size) o.size = `${num(n.size.x)}×${num(n.size.y)}`;
  if (n.transform) o.at = `${num(n.transform.m02)},${num(n.transform.m12)}`;
  if (n.visible === false) o.visible = false;
  if (n.opacity !== undefined && n.opacity < 0.999) o.opacity = +n.opacity.toFixed(3);

  if (n.stackMode && n.stackMode !== 'NONE') {
    const pad = [
      n.stackPaddingTop ?? n.stackVerticalPadding ?? 0,
      n.stackPaddingRight ?? n.stackHorizontalPadding ?? 0,
      n.stackPaddingBottom ?? n.stackVerticalPadding ?? 0,
      n.stackPaddingLeft ?? n.stackHorizontalPadding ?? 0,
    ];
    o.layout = `flex ${n.stackMode === 'HORIZONTAL' ? 'row' : 'column'}`;
    if (n.stackSpacing) o.gap = n.stackSpacing;
    if (pad.some((v) => v)) o.padding = pad.map(num).join(' ');
    if (n.stackPrimaryAlignItems) o.justify = n.stackPrimaryAlignItems;
    if (n.stackCounterAlignItems) o.align = n.stackCounterAlignItems;
    if (n.stackPrimarySizing) o.primarySizing = n.stackPrimarySizing;
    if (n.stackCounterSizing) o.counterSizing = n.stackCounterSizing;
    if (n.stackWrap) o.wrap = n.stackWrap;
  }
  if (n.stackChildPrimaryGrow) o.grow = n.stackChildPrimaryGrow;
  if (n.stackChildAlignSelf && n.stackChildAlignSelf !== 'AUTO') o.alignSelf = n.stackChildAlignSelf;

  const rc = [
    n.rectangleTopLeftCornerRadius,
    n.rectangleTopRightCornerRadius,
    n.rectangleBottomRightCornerRadius,
    n.rectangleBottomLeftCornerRadius,
  ];
  if (n.rectangleCornerRadiiIndependent && rc.some((v) => v)) o.radius = rc.map((v) => v ?? 0).join(' ');
  else if (n.cornerRadius) o.radius = n.cornerRadius;

  const f = paints(n.fillPaints);
  if (f) o.fill = f;
  const s = paints(n.strokePaints);
  if (s) {
    o.stroke = s;
    const w = [n.borderTopWeight, n.borderRightWeight, n.borderBottomWeight, n.borderLeftWeight];
    o.strokeWeight = w.some((x) => x !== undefined && x !== w[0]) ? w.map((x) => x ?? 0).join(' ') : (n.strokeWeight ?? 1);
    if (n.strokeAlign) o.strokeAlign = n.strokeAlign;
  }
  const ef = (n.effects ?? []).map(effect).filter(Boolean);
  if (ef.length) o.effects = ef.join(', ');

  if (n.type === 'TEXT') {
    o.font = `${n.fontName?.family} ${n.fontName?.style}`;
    o.fontSize = n.fontSize;
    if (n.lineHeight)
      o.lineHeight =
        n.lineHeight.units === 'PIXELS'
          ? `${+n.lineHeight.value.toFixed(2)}px`
          : `${+n.lineHeight.value.toFixed(3)}× (=${+(n.lineHeight.value * n.fontSize).toFixed(2)}px)`;
    if (n.letterSpacing?.value)
      o.letterSpacing = `${+n.letterSpacing.value.toFixed(3)}${n.letterSpacing.units === 'PERCENT' ? '%' : 'px'}`;
    if (n.textAlignHorizontal) o.textAlign = n.textAlignHorizontal;
    if (n.textAlignVertical) o.textAlignV = n.textAlignVertical;
    if (n.textAutoResize) o.autoResize = n.textAutoResize;
    if (n.textCase) o.textCase = n.textCase;
    if (n.textDecoration) o.textDecoration = n.textDecoration;
    const t = n.textData?.characters;
    if (t) o.text = t.length > 120 ? t.slice(0, 120) + '…' : t;
    const st = n.textData?.styleOverrideTable;
    if (st?.length)
      o.styleRuns = st
        .map((r) => `${r.fontName?.family ?? ''} ${r.fontName?.style ?? ''}${r.fontSize ? ' ' + r.fontSize : ''}${r.fillPaints ? ' ' + paints(r.fillPaints) : ''}`.trim())
        .join(' | ');
  }

  if (n.symbolData?.symbolID) o.instanceOf = gid(n.symbolData.symbolID);
  if (n.blendMode && n.blendMode !== 'NORMAL') o.blend = n.blendMode;
  if (n.clipsContent === false) o.clips = false;
  if (n.mask) o.mask = true;
  if (n.horizontalConstraint) o.hConstraint = n.horizontalConstraint;
  if (n.verticalConstraint) o.vConstraint = n.verticalConstraint;
  return o;
}

const fmt = (o) =>
  Object.entries(o)
    .map(([k, v]) => `${k}=${v}`)
    .join('  ');

/* ─── обход ─────────────────────────────────────────────────────── */

export function resolveTree(rootId, maxDepth = 40, textOnly = false) {
  const out = [];
  const seen = new Set();

  function walk(id, ctxs, indent, depth, absX, absY) {
    const base = byId.get(id);
    if (!base) return;
    const { node, resolved } = resolveProps(base, id, ctxs);

    // Абсолютная позиция внутри экрана — считать по месту проще, чем сверять «at».
    const x = absX + (node.transform ? node.transform.m02 : 0);
    const y = absY + (node.transform ? node.transform.m12 : 0);

    const d = describe(node);
    if (node.size) d.abs = `${num(x)},${num(y)}`;
    if (resolved) d.src = 'override';
    if (!textOnly || node.type === 'TEXT')
      out.push(`${indent}${node.type} «${node.name}» [${id}]  ${fmt(d)}`);

    if (depth <= 0) return;
    if (node.visible === false) return;

    const symId = node.symbolData?.symbolID ? gid(node.symbolData.symbolID) : null;
    // Циклы бывают у самоссылающихся компонентов — обрываем.
    if (symId && seen.has(`${id}@${symId}`)) return;

    let childCtxs = ctxs;
    let children;
    if (symId) {
      seen.add(`${id}@${symId}`);
      childCtxs = ctxs.map((c) => ({ ...c, path: [...c.path, id] }));
      childCtxs = [...childCtxs, makeCtx(node)];
      children = kids.get(symId) ?? [];
    } else {
      children = kids.get(id) ?? [];
    }
    for (const k of children) walk(gid(k.guid), childCtxs, indent + '  ', depth - 1, x, y);
    if (symId) seen.delete(`${id}@${symId}`);
  }

  // abs отсчитываем от левого верхнего угла самого экрана, а не холста Figma,
  // чтобы числа сравнивались напрямую с getBoundingClientRect живой страницы.
  const root = byId.get(rootId);
  const ox = root?.transform ? root.transform.m02 : 0;
  const oy = root?.transform ? root.transform.m12 : 0;
  walk(rootId, [], '', maxDepth, -ox, -oy);
  return out;
}

/* ─── CLI ───────────────────────────────────────────────────────── */

const [, , cmd, ...rest] = process.argv;
const flag = (n, d) => {
  const i = rest.indexOf(n);
  return i === -1 ? d : rest[i + 1];
};

if (cmd === 'dump') {
  const outDir = flag('--out', 'design/raw/spec/resolved');
  fs.mkdirSync(outDir, { recursive: true });
  const SCREENS = (flag('--ids') ?? '1279:104497,1279:104507,1279:104517,1279:104710,1279:104972').split(',');
  for (const id of SCREENS) {
    const n = byId.get(id);
    if (!n) {
      console.error(`нет узла ${id}`);
      continue;
    }
    const lines = resolveTree(id, +flag('--depth', 40));
    const file = path.join(outDir, `${id.replace(':', '_')}.txt`);
    fs.writeFileSync(
      file,
      `# ${n.type} «${n.name}» [${id}]  ${fmt(describe(n))}\n` +
        `# переопределения инстансов разрешены (src=override — значение из symbolOverrides/derivedSymbolData)\n` +
        `# abs=X,Y — позиция от левого верхнего угла экрана\n\n` +
        lines.join('\n') +
        '\n',
    );
    console.log(`${id} → ${file} (${lines.length} строк)`);
  }
} else if (cmd) {
  console.log(resolveTree(cmd, +flag('--depth', 40), rest.includes('--text')).join('\n'));
} else {
  console.error('использование: fig-resolve.mjs <node-id> [--depth N] [--text] | dump [--out DIR]');
  process.exit(1);
}
