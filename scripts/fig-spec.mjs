/**
 * Спеки из декодированного .fig: точные размеры, отступы, цвета, типографика.
 * Сначала `node scripts/fig-decode.mjs <файл.fig>`, затем:
 *
 *   node scripts/fig-spec.mjs spec <node-id> [--depth N] [--text] [--json]
 *   node scripts/fig-spec.mjs find <regexp> [--type TYPE] [--limit N]
 *   node scripts/fig-spec.mjs kids <node-id>
 *   node scripts/fig-spec.mjs vars [regexp]   — переменные (дизайн-токены)
 *   node scripts/fig-spec.mjs pages
 *
 * Дереву нужен большой heap: NODE_OPTIONS=--max-old-space-size=8192.
 *
 * ВНИМАНИЕ. Для сверки вёрстки по брейкпоинтам бери scripts/fig-resolve.mjs,
 * а не этот файл. Здесь разрешены только РАЗМЕРЫ детей инстансов (из
 * derivedSymbolData, см. ниже), а координаты, отступы и тексты по-прежнему
 * печатаются мастерские: у INSTANCE нет своих детей, содержимое лежит в
 * мастер-компоненте. fig-resolve.mjs разрешает переопределения целиком —
 * и symbolOverrides, и derivedSymbolData, с абсолютными координатами.
 */
import fs from 'node:fs';

const DOC = process.env.FIG_DOC ?? 'design/raw/doc.json';

const raw = JSON.parse(fs.readFileSync(DOC, 'utf8'));
const nodes = raw.nodeChanges;
export const gid = (g) => (g ? `${g.sessionID}:${g.localID}` : null);

const byId = new Map();
for (const n of nodes) byId.set(gid(n.guid), n);

// Дети + порядок по fractional index (parentIndex.position)
const kids = new Map();
for (const n of nodes) {
  const p = n.parentIndex?.guid ? gid(n.parentIndex.guid) : null;
  if (!p) continue;
  if (!kids.has(p)) kids.set(p, []);
  kids.get(p).push(n);
}
for (const arr of kids.values()) {
  arr.sort((a, b) => {
    const x = a.parentIndex?.position ?? '';
    const y = b.parentIndex?.position ?? '';
    return x < y ? -1 : x > y ? 1 : 0;
  });
}

export const childrenOf = (id) => kids.get(id) ?? [];
export const nodeById = (id) => byId.get(id);

/**
 * Дети с проваливанием в мастер-компонент: у INSTANCE в .fig своих детей нет,
 * содержимое лежит в SYMBOL, на который указывает symbolData.symbolID.
 * Без этого обход упирается в тупик на каждой плате дизайн-системы.
 */
/**
 * Реальные размеры детей инстанса.
 *
 * У INSTANCE своих детей нет: обход проваливается в мастер-символ и показывает
 * ЕГО геометрию. Настоящие размеры конкретного инстанса Figma держит отдельно,
 * в derivedSymbolData: список {guidPath, size}. Без этого больше половины
 * размеров в выгрузке — дефолты мастера (кнопки шапки на 480/360 реально
 * 38×38, мастер отдаёт 50×50).
 *
 * Устройство guidPath: путь накапливает ТОЛЬКО границы вложенных инстансов,
 * обычные фреймы в него не входят. То есть ключ узла — это цепочка guid-ов
 * инстансов-предков внутри мастера плюс собственный guid узла.
 */
const derivedSize = new Map();
for (const n of nodes) {
  const inst = gid(n.guid);
  for (const e of n.derivedSymbolData ?? []) {
    const path = e?.guidPath?.guids;
    if (!e?.size || !path?.length) continue;
    derivedSize.set(`${inst}|${path.map(gid).join('/')}`, e.size);
  }
}

/** Узел — инстанс, содержимое которого берётся из мастера. */
const isInstance = (id) => Boolean(byId.get(id)?.symbolData?.symbolID) && !kids.get(id)?.length;

export function effectiveChildren(id) {
  const own = kids.get(id);
  if (own?.length) return own;
  const sym = byId.get(id)?.symbolData?.symbolID;
  const symId = sym ? gid(sym) : null;
  return symId && symId !== id ? (kids.get(symId) ?? []) : [];
}

/* ─── цвета ─────────────────────────────────────────────────────── */
const ch = (v) => Math.round((v ?? 0) * 255);
export function hex(c) {
  if (!c) return null;
  const s = `#${[ch(c.r), ch(c.g), ch(c.b)].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
  return c.a === undefined || c.a >= 0.999 ? s.toUpperCase() : `${s.toUpperCase()} ${+(c.a * 100).toFixed(1)}%`;
}
function paint(p) {
  if (!p || p.visible === false) return null;
  const op = p.opacity !== undefined && p.opacity < 0.999 ? ` op=${+(p.opacity * 100).toFixed(1)}%` : '';
  if (p.type === 'SOLID') return `${hex(p.color)}${op}`;
  if (p.type?.startsWith('GRADIENT')) {
    const stops = (p.stops ?? []).map((s) => `${hex(s.color)}@${+(s.position * 100).toFixed(0)}%`).join(', ');
    const t = p.transform;
    const geo = t ? ` [m=${[t.m00, t.m01, t.m02, t.m10, t.m11, t.m12].map((v) => +(+v).toFixed(3)).join(',')}]` : '';
    return `${p.type}(${stops})${op}${geo}`;
  }
  if (p.type === 'IMAGE') return `IMAGE(${p.image?.hash ?? '?'} ${p.imageScaleMode ?? ''})${op}`;
  return `${p.type}${op}`;
}
const paints = (arr) => (arr ?? []).map(paint).filter(Boolean).join(' | ') || null;

/* ─── эффекты ───────────────────────────────────────────────────── */
function effect(e) {
  if (!e || e.visible === false) return null;
  const o = e.offset ?? { x: 0, y: 0 };
  if (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW')
    return `${e.type === 'INNER_SHADOW' ? 'inset ' : ''}${o.x}px ${o.y}px ${e.radius ?? 0}px ${e.spread ?? 0}px ${hex(e.color)}`;
  if (e.type === 'FOREGROUND_BLUR' || e.type === 'LAYER_BLUR') return `blur(${e.radius}px)`;
  if (e.type === 'BACKGROUND_BLUR') return `backdrop-blur(${e.radius}px)`;
  return `${e.type}(${e.radius ?? ''})`;
}

/* ─── описание одного узла ──────────────────────────────────────── */
export function describe(n, opts = {}) {
  const o = {};
  o.id = gid(n.guid);
  o.name = n.name;
  o.type = n.type;
  // размер конкретного инстанса приоритетнее мастерского, см. derivedSize
  const size = opts.size ?? n.size;
  if (size) o.size = `${+size.x.toFixed(2)}×${+size.y.toFixed(2)}`;
  if (
    opts.size &&
    n.size &&
    (Math.abs(n.size.x - opts.size.x) > 0.5 || Math.abs(n.size.y - opts.size.y) > 0.5)
  )
    o.masterSize = `${+n.size.x.toFixed(2)}×${+n.size.y.toFixed(2)}`;
  if (n.transform) o.at = `${+n.transform.m02.toFixed(2)},${+n.transform.m12.toFixed(2)}`;
  if (n.visible === false) o.visible = false;
  if (n.opacity !== undefined && n.opacity < 0.999) o.opacity = +n.opacity.toFixed(3);

  // авто-layout
  if (n.stackMode && n.stackMode !== 'NONE') {
    const dir = n.stackMode === 'HORIZONTAL' ? 'row' : 'column';
    const pad = [
      n.stackPaddingTop ?? n.stackVerticalPadding ?? 0,
      n.stackPaddingRight ?? n.stackHorizontalPadding ?? 0,
      n.stackPaddingBottom ?? n.stackVerticalPadding ?? 0,
      n.stackPaddingLeft ?? n.stackHorizontalPadding ?? 0,
    ];
    o.layout = `flex ${dir}`;
    if (n.stackSpacing) o.gap = n.stackSpacing;
    if (pad.some((v) => v)) o.padding = pad.join(' ');
    if (n.stackPrimaryAlignItems) o.justify = n.stackPrimaryAlignItems;
    if (n.stackCounterAlignItems) o.align = n.stackCounterAlignItems;
    if (n.stackPrimarySizing) o.primarySizing = n.stackPrimarySizing;
    if (n.stackCounterSizing) o.counterSizing = n.stackCounterSizing;
    if (n.stackWrap) o.wrap = n.stackWrap;
  }
  if (n.stackChildPrimaryGrow) o.grow = n.stackChildPrimaryGrow;
  if (n.stackChildAlignSelf && n.stackChildAlignSelf !== 'AUTO') o.alignSelf = n.stackChildAlignSelf;

  // радиусы
  const rc = [
    n.rectangleTopLeftCornerRadius,
    n.rectangleTopRightCornerRadius,
    n.rectangleBottomRightCornerRadius,
    n.rectangleBottomLeftCornerRadius,
  ];
  if (n.rectangleCornerRadiiIndependent && rc.some((v) => v)) o.radius = rc.map((v) => v ?? 0).join(' ');
  else if (n.cornerRadius) o.radius = n.cornerRadius;

  // заливки / обводки
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

  // типографика
  if (n.type === 'TEXT') {
    o.font = `${n.fontName?.family} ${n.fontName?.style}`;
    o.fontSize = n.fontSize;
    // PERCENT в .fig хранится множителем: 1.2 = 120% кегля.
    if (n.lineHeight)
      o.lineHeight =
        n.lineHeight.units === 'PIXELS'
          ? `${+n.lineHeight.value.toFixed(2)}px`
          : `${+n.lineHeight.value.toFixed(3)}× (=${+(n.lineHeight.value * n.fontSize).toFixed(2)}px)`;
    if (n.letterSpacing?.value) o.letterSpacing = `${+n.letterSpacing.value.toFixed(3)}${n.letterSpacing.units === 'PERCENT' ? '%' : 'px'}`;
    if (n.textAlignHorizontal) o.textAlign = n.textAlignHorizontal;
    if (n.textAlignVertical) o.textAlignV = n.textAlignVertical;
    if (n.textAutoResize) o.autoResize = n.textAutoResize;
    if (n.textCase) o.textCase = n.textCase;
    if (n.textDecoration) o.textDecoration = n.textDecoration;
    if (n.fontVariations?.length) o.fontVariations = n.fontVariations.map((v) => `${v.axisTag}=${v.value}`).join(',');
    const t = n.textData?.characters;
    if (t) o.text = t.length > 120 ? t.slice(0, 120) + '…' : t;
    // посимвольные переопределения стиля
    const ov = n.textData?.characterStyleIDs;
    if (ov?.length) o.hasStyleRuns = true;
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
    .filter(([k]) => k !== 'id' && k !== 'name' && k !== 'type')
    .map(([k, v]) => `${k}=${v}`)
    .join('  ');

export function tree(id, depth, indent = '', textOnly = false, out = [], ctx = null) {
  const n = byId.get(id);
  if (!n) return out;
  // внутри инстанса размер ищем по «цепочка инстансов-предков + свой guid»
  const size = ctx ? derivedSize.get(`${ctx.inst}|${[...ctx.chain, id].join('/')}`) : undefined;
  const d = describe(n, size ? { size } : {});
  if (!textOnly || n.type === 'TEXT')
    out.push(`${indent}${n.type} «${n.name}» [${d.id}]  ${fmt(d)}`);
  if (depth > 0) {
    // корень контекста — сам инстанс; глубже цепочка растёт только на инстансах
    const next = ctx
      ? { inst: ctx.inst, chain: isInstance(id) ? [...ctx.chain, id] : ctx.chain }
      : isInstance(id)
        ? { inst: id, chain: [] }
        : null;
    for (const k of effectiveChildren(id))
      tree(gid(k.guid), depth - 1, indent + '  ', textOnly, out, next);
  }
  return out;
}

/* ─── CLI ───────────────────────────────────────────────────────── */
const [, , cmd, ...rest] = process.argv;
const flag = (name, def) => {
  const i = rest.indexOf(name);
  return i === -1 ? def : rest[i + 1];
};
const has = (name) => rest.includes(name);

if (cmd === 'spec') {
  const id = rest[0];
  const depth = +flag('--depth', 3);
  if (has('--json')) {
    const walk = (i, d) => {
      const n = byId.get(i);
      if (!n) return null;
      const o = describe(n);
      if (d > 0) o.children = effectiveChildren(i).map((k) => walk(gid(k.guid), d - 1)).filter(Boolean);
      return o;
    };
    console.log(JSON.stringify(walk(id, depth), null, 1));
  } else {
    console.log(tree(id, depth, '', has('--text')).join('\n'));
  }
} else if (cmd === 'find') {
  const re = new RegExp(rest[0], 'i');
  const type = flag('--type');
  const limit = +flag('--limit', 60);
  let n = 0;
  for (const node of nodes) {
    if (type && node.type !== type) continue;
    if (!re.test(node.name ?? '')) continue;
    const d = describe(node);
    const parent = node.parentIndex?.guid ? byId.get(gid(node.parentIndex.guid)) : null;
    console.log(`${node.type} «${node.name}» [${d.id}] ${d.size ?? ''} ← «${parent?.name ?? '-'}»`);
    if (++n >= limit) break;
  }
} else if (cmd === 'kids') {
  for (const k of effectiveChildren(rest[0])) {
    const d = describe(k);
    console.log(`${k.type} «${k.name}» [${d.id}]  ${fmt(d)}`);
  }
} else if (cmd === 'pages') {
  const doc = nodes.find((n) => n.type === 'DOCUMENT');
  for (const c of childrenOf(gid(doc.guid))) {
    console.log(`${c.type} «${c.name}» [${gid(c.guid)}] children=${childrenOf(gid(c.guid)).length}`);
  }
} else if (cmd === 'vars') {
  // Переменные лежат не внутри набора, а на служебном канвасе; связь — variableSetID.
  const sets = nodes.filter((n) => n.type === 'VARIABLE_SET');
  // Ссылка бывает двух форм: локальная {guid} и импортированная {assetRef:{key}}
  const setKey = (v) => v?.assetRef?.key ?? (v?.guid ? gid(v.guid) : gid(v));
  const setsByKey = new Map();
  for (const s of sets) setsByKey.set(gid(s.guid), s);

  const varsBySet = new Map();
  const varById = new Map();
  const varByKey = new Map();
  for (const v of nodes) {
    if (v.type !== 'VARIABLE') continue;
    varById.set(gid(v.guid), v);
    if (v.key) varByKey.set(v.key, v);
    const k = setKey(v.variableSetID);
    if (!varsBySet.has(k)) varsBySet.set(k, []);
    varsBySet.get(k).push(v);
  }
  const resolveAlias = (a) => {
    const t = a?.assetRef?.key ? varByKey.get(a.assetRef.key) : varById.get(a?.guid ? gid(a.guid) : gid(a));
    return t;
  };
  // Соотносим наборы с их переменными: по guid набора либо по assetRef-ключу
  const modeName = new Map();
  for (const s of sets) for (const m of s.variableSetModes ?? []) modeName.set(gid(m.id), m.name);

  const render = (v) => {
    const entries = v.variableDataValues?.entries ?? [];
    return entries
      .map((e) => {
        const mn = modeName.get(gid(e.modeID)) ?? gid(e.modeID);
        const val = e.variableData?.value ?? {};
        let out;
        if (val.colorValue) out = hex(val.colorValue);
        else if (val.floatValue !== undefined) out = String(val.floatValue);
        else if (val.textValue !== undefined) out = `"${val.textValue}"`;
        else if (val.boolValue !== undefined) out = String(val.boolValue);
        else if (val.alias) {
          const t = resolveAlias(val.alias);
          // разворачиваем цепочку алиасов до конечного значения
          let leaf = t,
            hops = 0;
          while (leaf && hops++ < 6) {
            const e0 = leaf.variableDataValues?.entries?.[0]?.variableData?.value;
            if (e0?.alias) leaf = resolveAlias(e0.alias);
            else break;
          }
          const lv = leaf?.variableDataValues?.entries?.[0]?.variableData?.value;
          const resolved = lv?.colorValue ? hex(lv.colorValue) : lv?.floatValue !== undefined ? lv.floatValue : lv?.textValue !== undefined ? `"${lv.textValue}"` : '?';
          out = `→ ${t?.name ?? '?'} = ${resolved}`;
        }
        else out = JSON.stringify(val).slice(0, 60);
        return entries.length > 1 ? `${mn}=${out}` : out;
      })
      .join('  ');
  };

  const filter = rest[0] ? new RegExp(rest[0], 'i') : null;
  const seen = new Set();
  for (const s of sets) {
    const list = varsBySet.get(gid(s.guid)) ?? [];
    if (!list.length) continue;
    seen.add(gid(s.guid));
    console.log(`\n=== «${s.name}» [${gid(s.guid)}] режимы: ${(s.variableSetModes ?? []).map((m) => m.name).join(', ')} ===`);
    for (const v of list.sort((a, b) => a.name.localeCompare(b.name))) {
      if (filter && !filter.test(v.name)) continue;
      console.log(`  ${v.name}\t${render(v)}`);
    }
  }
  // наборы, пришедшие из подключённых библиотек (assetRef)
  for (const [k, list] of varsBySet) {
    if (setsByKey.has(k)) continue;
    console.log(`\n=== [библиотека ${String(k).slice(0, 12)}…] ${list.length} перем. ===`);
    for (const v of list.sort((a, b) => a.name.localeCompare(b.name))) {
      if (filter && !filter.test(v.name)) continue;
      console.log(`  ${v.name}\t${render(v)}`);
    }
  }
}
