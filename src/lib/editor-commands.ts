/**
 * Команды панели форматирования — чистая математика над строкой и позицией
 * каретки, без DOM. Вынесено отдельно, чтобы это можно было протестировать:
 * именно здесь такие редакторы обычно и ломаются (курсор прыгает, повторное
 * нажатие добавляет вторую пару звёздочек вместо снятия).
 */

export type EditCommand = 'bold' | 'italic' | 'h2' | 'h3' | 'bullet' | 'ordered' | 'link';

export type EditResult = {
  value: string;
  selStart: number;
  selEnd: number;
};

/** Текст-заглушка, когда команду нажали без выделения. */
const PLACEHOLDER: Partial<Record<EditCommand, string>> = {
  bold: 'текст',
  italic: 'текст',
  link: 'текст ссылки',
};

const WRAP: Partial<Record<EditCommand, string>> = { bold: '**', italic: '*' };

/** Префиксы блочных команд и общий шаблон для снятия чужого префикса. */
const PREFIX: Partial<Record<EditCommand, (i: number) => string>> = {
  h2: () => '## ',
  h3: () => '### ',
  bullet: () => '- ',
  ordered: (i) => `${i + 1}. `,
};

const ANY_PREFIX = /^(#{1,6}\s+|[-*•]\s+|\d{1,3}[.)]\s+)/;

export function applyCommand(
  cmd: EditCommand,
  value: string,
  start: number,
  end: number,
): EditResult {
  if (cmd === 'link') return applyLink(value, start, end);
  if (WRAP[cmd]) return applyWrap(WRAP[cmd]!, PLACEHOLDER[cmd] ?? '', value, start, end);
  return applyBlock(cmd, value, start, end);
}

/** Обёртка выделения маркером; повторное нажатие снимает уже стоящий. */
function applyWrap(
  marker: string,
  placeholder: string,
  value: string,
  start: number,
  end: number,
): EditResult {
  const selected = value.slice(start, end);
  const len = marker.length;

  // маркеры уже стоят вокруг выделения — снимаем (toggle off)
  if (value.slice(start - len, start) === marker && value.slice(end, end + len) === marker) {
    return {
      value: value.slice(0, start - len) + selected + value.slice(end + len),
      selStart: start - len,
      selEnd: end - len,
    };
  }

  // выделение само содержит маркеры — снимаем изнутри
  if (selected.length >= len * 2 && selected.startsWith(marker) && selected.endsWith(marker)) {
    const inner = selected.slice(len, -len);
    return {
      value: value.slice(0, start) + inner + value.slice(end),
      selStart: start,
      selEnd: start + inner.length,
    };
  }

  const text = selected || placeholder;
  return {
    value: value.slice(0, start) + marker + text + marker + value.slice(end),
    selStart: start + len,
    selEnd: start + len + text.length,
  };
}

function applyLink(value: string, start: number, end: number): EditResult {
  const text = value.slice(start, end) || PLACEHOLDER.link!;
  const inserted = `[${text}](https://)`;
  return {
    value: value.slice(0, start) + inserted + value.slice(end),
    // выделяем адрес — редактор сразу вставит свой поверх
    selStart: start + text.length + 3,
    selEnd: start + text.length + 3 + 'https://'.length,
  };
}

/** Границы строк, попавших в выделение. */
function lineRange(value: string, start: number, end: number): [number, number] {
  const from = value.lastIndexOf('\n', start - 1) + 1;
  const nl = value.indexOf('\n', end);
  return [from, nl === -1 ? value.length : nl];
}

function applyBlock(cmd: EditCommand, value: string, start: number, end: number): EditResult {
  const make = PREFIX[cmd];
  if (!make) return { value, selStart: start, selEnd: end };

  const [from, to] = lineRange(value, start, end);
  const lines = value.slice(from, to).split('\n');

  // если префикс уже стоит на всех строках — снимаем его
  const allHave = lines.every((line, i) => line.startsWith(make(i)));
  const next = lines
    .map((line, i) => {
      const bare = line.replace(ANY_PREFIX, '');
      return allHave ? bare : make(i) + bare;
    })
    .join('\n');

  return {
    value: value.slice(0, from) + next + value.slice(to),
    selStart: from,
    selEnd: from + next.length,
  };
}

/**
 * Enter внутри списка: продолжает нумерацию/маркер, а на пустом пункте
 * выходит из списка. null — обычный перевод строки.
 */
export function continueList(value: string, caret: number): EditResult | null {
  const from = value.lastIndexOf('\n', caret - 1) + 1;
  const line = value.slice(from, caret);

  const bullet = /^([-*•])\s+(.*)$/.exec(line);
  const ordered = /^(\d{1,3})[.)]\s+(.*)$/.exec(line);
  if (!bullet && !ordered) return null;

  const rest = (bullet ? bullet[2] : ordered![2]).trim();

  // пустой пункт — выходим из списка, убирая маркер
  if (!rest) {
    return {
      value: value.slice(0, from) + value.slice(caret),
      selStart: from,
      selEnd: from,
    };
  }

  const prefix = bullet ? `${bullet[1]} ` : `${Number(ordered![1]) + 1}. `;
  const inserted = `\n${prefix}`;
  return {
    value: value.slice(0, caret) + inserted + value.slice(caret),
    selStart: caret + inserted.length,
    selEnd: caret + inserted.length,
  };
}
