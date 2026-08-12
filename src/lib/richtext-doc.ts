import { parseRichText, isSafeHref, type Block, type Inline } from './richtext';

export { isSafeHref };

/**
 * Хранимый формат текста новости — JSON-документ Tiptap (WYSIWYG-редактор
 * админки), а не строка разметки. `NodeJson`/`MarkJson` — не типы Tiptap, а
 * СВОЙ узкий контракт: рендерер (RichText.tsx) проверяет `type` каждого узла
 * по явному списку и никогда не строит HTML-строку, поэтому хранимые данные
 * остаются недоверенными ровно как и раньше — просто дерево вместо строки.
 *
 * `parseRichText`/`Inline`/`Block` из ./richtext остаются: это единственный
 * путь миграции старых новостей (тело — строка `**жирный**`/`## `/…) в новый
 * формат, и он уже покрыт тестами. Публичные новости, сохранённые до этого
 * изменения, читаются как раньше — просто один раз конвертируются на лету.
 */

export type MarkJson = { type: string; attrs?: Record<string, unknown> };

export type NodeJson = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: NodeJson[];
  text?: string;
  marks?: MarkJson[];
};

export type Doc = { type: 'doc'; content: NodeJson[] };

export function emptyDoc(): Doc {
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

function isDoc(value: unknown): value is Doc {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return v.type === 'doc' && Array.isArray(v.content);
}

/** Разбирает тело новости: новый JSON-документ или старая строка-разметка. */
export function parseStoredBody(source: string): Doc {
  const raw = String(source ?? '');
  const trimmed = raw.trim();
  if (!trimmed) return emptyDoc();
  try {
    const parsed = JSON.parse(trimmed);
    if (isDoc(parsed)) return parsed;
  } catch {
    // не JSON — значит старая разметка, разбираем ниже
  }
  return legacyToDoc(raw);
}

export function serializeDoc(doc: Doc): string {
  return JSON.stringify(doc);
}

// ---- миграция старой markdown-подобной разметки в Tiptap JSON ----

function legacyInlineToJson(nodes: Inline[], marks: MarkJson[] = []): NodeJson[] {
  const out: NodeJson[] = [];
  for (const node of nodes) {
    if (node.type === 'text') {
      if (!node.value) continue;
      out.push(marks.length ? { type: 'text', text: node.value, marks } : { type: 'text', text: node.value });
      continue;
    }
    if (node.type === 'bold') {
      out.push(...legacyInlineToJson(node.children, [...marks, { type: 'bold' }]));
    } else if (node.type === 'italic') {
      out.push(...legacyInlineToJson(node.children, [...marks, { type: 'italic' }]));
    } else if (node.type === 'strike') {
      out.push(...legacyInlineToJson(node.children, [...marks, { type: 'strike' }]));
    } else if (node.type === 'mark') {
      out.push(...legacyInlineToJson(node.children, [...marks, { type: 'highlight' }]));
    } else if (node.type === 'link') {
      out.push(...legacyInlineToJson(node.children, [...marks, { type: 'link', attrs: { href: node.href } }]));
    }
  }
  return out;
}

function wrapParagraph(children: Inline[]): NodeJson {
  const content = legacyInlineToJson(children);
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' };
}

function legacyBlockToJson(block: Block): NodeJson {
  if (block.type === 'heading') {
    return { type: 'heading', attrs: { level: block.level }, content: legacyInlineToJson(block.children) };
  }
  if (block.type === 'paragraph') return wrapParagraph(block.children);
  if (block.type === 'list') {
    return {
      type: block.ordered ? 'orderedList' : 'bulletList',
      content: block.items.map((item) => ({ type: 'listItem', content: [wrapParagraph(item)] })),
    };
  }
  if (block.type === 'quote') return { type: 'blockquote', content: [wrapParagraph(block.children)] };
  if (block.type === 'callout') return { type: 'callout', content: [wrapParagraph(block.children)] };
  return { type: 'horizontalRule' };
}

function legacyToDoc(source: string): Doc {
  const content = parseRichText(source).map(legacyBlockToJson);
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}

// ---- текстовые узлы по порядку: для машинного перевода (server/translate.ts) ----

/**
 * Плоский список текста всех листьев дерева, в порядке обхода. Перевод
 * трогает только эти строки — структура (типы узлов, марки, атрибуты)
 * никогда не уходит переводчику и не может быть им испорчена.
 */
export function docTextLeaves(doc: Doc): string[] {
  const out: string[] = [];
  const walk = (nodes: NodeJson[] | undefined) => {
    if (!nodes) return;
    for (const n of nodes) {
      if (n.type === 'text' && n.text) out.push(n.text);
      else walk(n.content);
    }
  };
  walk(doc.content);
  return out;
}

/**
 * Копия документа с текстом листьев, подставленным из `leaves` — строго в
 * том же порядке обхода, что и docTextLeaves. Марки, атрибуты и структура
 * блоков не меняются; лишних или недостающих строк не бывает — вызывающий
 * код (translateDoc) всегда передаёт leaves той же длины и порядка.
 */
export function withTranslatedLeaves(doc: Doc, leaves: string[]): Doc {
  const queue = [...leaves];
  const walk = (nodes: NodeJson[] | undefined): NodeJson[] | undefined => {
    if (!nodes) return nodes;
    return nodes.map((n) => {
      if (n.type === 'text' && n.text) {
        const next = queue.shift();
        return next === undefined ? n : { ...n, text: next };
      }
      if (n.content) return { ...n, content: walk(n.content) };
      return n;
    });
  };
  return { type: 'doc', content: walk(doc.content) ?? [] };
}

// ---- обычный текст: для анонса ленты, alt-текста, выжимки в поиске ----

function walkPlain(nodes: NodeJson[] | undefined, out: string[]): void {
  if (!nodes) return;
  for (const n of nodes) {
    if (n.type === 'text' && n.text) out.push(n.text);
    else walkPlain(n.content, out);
    if (n.type === 'paragraph' || n.type === 'heading' || n.type === 'listItem') out.push(' ');
  }
}

export function docToPlainText(doc: Doc, limit?: number): string {
  const out: string[] = [];
  walkPlain(doc.content, out);
  const flat = out.join('').replace(/\s+/g, ' ').trim();
  if (!limit || flat.length <= limit) return flat;
  // режем по границе слова, чтобы выжимка не обрывалась посреди слова
  const cut = flat.slice(0, limit);
  const space = cut.lastIndexOf(' ');
  return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Тот же снимок текста, но прямо из сырого хранимого поля (любой формат). */
export function plainTextFromStoredBody(source: string, limit?: number): string {
  return docToPlainText(parseStoredBody(source), limit);
}

/**
 * Анонс с сохранённым оформлением — первый непустой блок статьи как
 * самостоятельный документ. Блок берётся целиком: резать дерево по числу
 * символов значило бы рвать разметку посреди выделения, а высоту в карточке
 * и так ограничивает обрезка по строкам.
 *
 * Общая для сервера (toPublicPost) и админки (превью ленты) — иначе превью
 * разошлось бы с сайтом ровно там, ради чего оно и сделано.
 */
export function richExcerptOf(source: string): string | null {
  const doc = parseStoredBody(source);
  const first = doc.content.find((n) => docToPlainText({ type: 'doc', content: [n] }).trim());
  return first ? serializeDoc({ type: 'doc', content: [first] }) : null;
}

/**
 * «Текста нет» — по видимому содержимому, а не по длине сырой строки.
 * JSON-документ без единого символа текста (пустой абзац) сериализуется в
 * непустую строку `{"type":"doc","content":[{"type":"paragraph"}]}`, поэтому
 * проверка вида `!body.trim()` (годилась для старой markdown-строки) на
 * новом формате всегда ложна — ей нельзя доверять «текст введён».
 */
export function isBodyEmpty(source: string): boolean {
  return !plainTextFromStoredBody(source).trim();
}

// ---- допустимые значения инлайновых стилей (цвет, шрифт) ----

/** Только `#rrggbb` — то, что реально пишет цветовой пикер редактора. */
export function isSafeColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

/**
 * Пункты пикера шрифта в редакторе. Хранится (и в марке text-стиля Tiptap, и
 * в документе) готовое значение CSS-переменной, а не ключ вида `serif`: так
 * сам редактор при вводе рендерит ровно тот же шрифт, что потом увидит
 * посетитель сайта — без этого Tiptap подставлял бы в style дженерик
 * `font-family: serif`, который ничем не похож на наш `--font-serif`.
 * Пропускаем в style только значения из этой же таблицы (isSafeFontFamily) —
 * произвольная строка из базы так же не попадёт в CSS, как и раньше.
 */
export const FONT_KEYS = ['sans', 'serif', 'display', 'geometric', 'mono'] as const;
export type FontKey = (typeof FONT_KEYS)[number];

export const FONT_STACK: Record<FontKey, string> = {
  sans: 'var(--font-sans)',
  serif: 'var(--font-serif)',
  display: 'var(--font-display)',
  geometric: 'var(--font-geometric)',
  mono: 'var(--font-editor-mono)',
};

export function isSafeFontFamily(value: unknown): value is string {
  return typeof value === 'string' && (Object.values(FONT_STACK) as string[]).includes(value);
}

/** Та же логика для размера текста: фиксированный набор пунктов пикера. */
export const SIZE_KEYS = ['small', 'normal', 'large', 'huge'] as const;
export type SizeKey = (typeof SIZE_KEYS)[number];

export const SIZE_STACK: Record<Exclude<SizeKey, 'normal'>, string> = {
  small: '0.8em',
  large: '1.3em',
  huge: '1.8em',
};

export function isSafeFontSize(value: unknown): value is string {
  return typeof value === 'string' && (Object.values(SIZE_STACK) as string[]).includes(value);
}

/** Выравнивание абзаца/заголовка — ровно то, что понимает TextAlign. */
export const TEXT_ALIGNS = ['left', 'center', 'right'] as const;
export type TextAlignValue = (typeof TEXT_ALIGNS)[number];

export function isSafeTextAlign(value: unknown): value is TextAlignValue {
  return typeof value === 'string' && (TEXT_ALIGNS as readonly string[]).includes(value);
}
