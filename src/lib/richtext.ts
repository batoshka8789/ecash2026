/**
 * Разметка текста новостей — подмножество Markdown, разобранное в дерево
 * объектов. Рендерер (components/ui/RichText.tsx) строит из него React-элементы
 * и НИКОГДА не собирает HTML-строку: `dangerouslySetInnerHTML` в проекте не
 * используется нигде, санитайзера нет — а раз HTML не собирается, то и
 * отравить его нечем. Единственная точка, куда попадают данные извне, — href,
 * и она закрыта белым списком схем (isSafeHref).
 *
 * Парсер намеренно ТОТАЛЬНЫЙ: недописанная разметка не ошибка, а обычный
 * текст. Он вызывается на каждое нажатие клавиши в живом превью, то есть
 * почти всегда видит незаконченную строку.
 */

export type Inline =
  | { type: 'text'; value: string }
  | { type: 'bold'; children: Inline[] }
  | { type: 'italic'; children: Inline[] }
  | { type: 'strike'; children: Inline[] }
  /** цветное выделение — акцент фирменным цветом */
  | { type: 'mark'; children: Inline[] }
  | { type: 'link'; href: string; children: Inline[] };

export type Block =
  | { type: 'heading'; level: 2 | 3; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] }
  | { type: 'quote'; children: Inline[] }
  /** врезка-примечание: цветной блок с акцентом */
  | { type: 'callout'; children: Inline[] }
  | { type: 'divider' };

/** Патологический ввод не должен подвешивать превью. */
const MAX_BLOCKS = 2000;
/** Ограничение вложенности жирный/курсив/ссылка. */
const MAX_DEPTH = 4;

/**
 * Разрешены только http(s), mailto и внутренние пути. Всё остальное —
 * в первую очередь `javascript:` и `data:` — ссылкой не становится,
 * текст остаётся текстом.
 */
export function isSafeHref(href: string): boolean {
  const v = href.trim();
  if (!v) return false;
  if (v.startsWith('/')) return !v.startsWith('//');
  return /^(https?:\/\/|mailto:)/i.test(v);
}

const RE_HEADING = /^(#{1,6})\s+(.*)$/;
const RE_BULLET = /^[-*•]\s+(.*)$/;
const RE_ORDERED = /^\d{1,3}[.)]\s+(.*)$/;
const RE_QUOTE = /^>\s?(.*)$/;
const RE_CALLOUT = /^!>\s?(.*)$/;
/** три и более дефиса/звёздочки в строке — разделитель */
const RE_DIVIDER = /^([-*_])\1{2,}$/;

/**
 * Одна строка — один блок; пустая строка только разделяет. Правило выбрано
 * ради предсказуемости для нетехнического редактора: нажал Enter — получил
 * новый абзац, без «нужно два перевода строки».
 */
export function parseRichText(source: string): Block[] {
  const lines = String(source ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n');

  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length && blocks.length < MAX_BLOCKS) {
    const line = lines[i].trim();

    if (!line) {
      i += 1;
      continue;
    }

    if (RE_DIVIDER.test(line)) {
      blocks.push({ type: 'divider' });
      i += 1;
      continue;
    }

    // врезку проверяем раньше цитаты: '!>' начинается не с '>'
    const callout = RE_CALLOUT.exec(line);
    if (callout) {
      blocks.push({ type: 'callout', children: parseInline(callout[1]) });
      i += 1;
      continue;
    }

    const quote = RE_QUOTE.exec(line);
    if (quote) {
      blocks.push({ type: 'quote', children: parseInline(quote[1]) });
      i += 1;
      continue;
    }

    const heading = RE_HEADING.exec(line);
    if (heading) {
      // Заголовок самой новости живёт в отдельном поле, поэтому внутри текста
      // верхний уровень — h2: одиночная решётка не должна выглядеть ошибкой.
      const level = heading[1].length >= 3 ? 3 : 2;
      blocks.push({ type: 'heading', level, children: parseInline(heading[2]) });
      i += 1;
      continue;
    }

    const bullet = RE_BULLET.exec(line);
    const ordered = RE_ORDERED.exec(line);
    if (bullet || ordered) {
      const isOrdered = Boolean(ordered);
      const items: Inline[][] = [];
      while (i < lines.length) {
        const cur = lines[i].trim();
        const m = isOrdered ? RE_ORDERED.exec(cur) : RE_BULLET.exec(cur);
        if (!m) break;
        items.push(parseInline(m[1]));
        i += 1;
      }
      blocks.push({ type: 'list', ordered: isOrdered, items });
      continue;
    }

    blocks.push({ type: 'paragraph', children: parseInline(line) });
    i += 1;
  }

  return blocks;
}

/**
 * Инлайновый разбор — один проход слева направо, без regex-replace: так нет
 * ни проблем с вложенностью, ни катастрофического бэктрекинга.
 *
 * Условие «примыкания» (после открывающего маркера не пробел, перед
 * закрывающим не пробел) спасает выражения вида `2 * 3 * 4` от превращения
 * в курсив.
 */
export function parseInline(source: string, depth = 0): Inline[] {
  const out: Inline[] = [];
  let buf = '';
  let i = 0;

  const flush = () => {
    if (buf) {
      out.push({ type: 'text', value: buf });
      buf = '';
    }
  };

  while (i < source.length) {
    const ch = source[i];

    // экранирование: \* \[ \\ и т.п. — следующий символ всегда буквальный
    if (ch === '\\' && i + 1 < source.length && /[\\*[\]()~=]/.test(source[i + 1])) {
      buf += source[i + 1];
      i += 2;
      continue;
    }

    if (depth < MAX_DEPTH && (ch === '~' || ch === '=')) {
      const marker = ch === '~' ? '~~' : '==';
      if (source.startsWith(marker, i)) {
        const m = matchWrapped(source, i, marker);
        if (m) {
          flush();
          out.push({
            type: ch === '~' ? 'strike' : 'mark',
            children: parseInline(m.inner, depth + 1),
          });
          i = m.next;
          continue;
        }
      }
    }

    if (depth < MAX_DEPTH && (ch === '*' || ch === '[')) {
      const bold = ch === '*' && source.startsWith('**', i) ? matchWrapped(source, i, '**') : null;
      if (bold) {
        flush();
        out.push({ type: 'bold', children: parseInline(bold.inner, depth + 1) });
        i = bold.next;
        continue;
      }

      const italic = ch === '*' && !source.startsWith('**', i) ? matchWrapped(source, i, '*') : null;
      if (italic) {
        flush();
        out.push({ type: 'italic', children: parseInline(italic.inner, depth + 1) });
        i = italic.next;
        continue;
      }

      if (ch === '[') {
        const link = /^\[([^\]\n]*)\]\(([^)\s]+)\)/.exec(source.slice(i));
        if (link && isSafeHref(link[2])) {
          flush();
          out.push({
            type: 'link',
            href: link[2].trim(),
            children: parseInline(link[1], depth + 1),
          });
          i += link[0].length;
          continue;
        }
      }
    }

    buf += ch;
    i += 1;
  }

  flush();
  return out;
}

/** Ищет парный маркер с проверкой примыкания. null — маркер не закрыт. */
function matchWrapped(
  source: string,
  start: number,
  marker: string,
): { inner: string; next: number } | null {
  const from = start + marker.length;
  if (from >= source.length || /\s/.test(source[from])) return null;

  let search = from;
  while (search < source.length) {
    const close = source.indexOf(marker, search);
    if (close === -1 || close === from) return null;
    // для одиночной звёздочки не принимаем часть двойной
    if (marker === '*' && source[close + 1] === '*') {
      search = close + 2;
      continue;
    }
    if (/\s/.test(source[close - 1])) {
      search = close + marker.length;
      continue;
    }
    // Хвост из трёх и более звёздочек (`**жирный *и курсив***`): закрывающей
    // парой берём ПОСЛЕДНИЕ две, лишнюю отдаём внутрь — там её закроет
    // вложенный курсив. Иначе внешний жирный съедал бы чужой маркер.
    let end = close;
    while (marker === '**' && source[end + 2] === '*' && !/\s/.test(source[end])) end += 1;
    return { inner: source.slice(from, end), next: end + marker.length };
  }
  return null;
}

/**
 * Текст без разметки: для автоматической выжимки в карточке ленты, для alt
 * картинки и для поиска по библиотеке.
 */
export function richTextToPlain(source: string, limit?: number): string {
  const flat = parseRichText(source)
    .map((block) => {
      if (block.type === 'divider') return '';
      if (block.type === 'list') return block.items.map(inlineToPlain).join(' ');
      return inlineToPlain(block.children);
    })
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!limit || flat.length <= limit) return flat;
  // режем по границе слова, чтобы выжимка не обрывалась посреди слова
  const cut = flat.slice(0, limit);
  const space = cut.lastIndexOf(' ');
  return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

function inlineToPlain(nodes: Inline[]): string {
  return nodes
    .map((n) => (n.type === 'text' ? n.value : inlineToPlain(n.children)))
    .join('');
}
