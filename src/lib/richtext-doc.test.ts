import { describe, expect, it } from 'vitest';
import {
  docTextLeaves,
  docToPlainText,
  emptyDoc,
  FONT_KEYS,
  FONT_STACK,
  isBodyEmpty,
  isSafeColor,
  isSafeFontFamily,
  parseStoredBody,
  plainTextFromStoredBody,
  serializeDoc,
  withTranslatedLeaves,
  type Doc,
} from './richtext-doc';

describe('parseStoredBody: пустое и JSON', () => {
  it('пустая строка — пустой документ с одним абзацем', () => {
    expect(parseStoredBody('')).toEqual(emptyDoc());
    expect(parseStoredBody('   \n  ')).toEqual(emptyDoc());
  });

  it('валидный JSON-документ возвращается как есть', () => {
    const doc: Doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Привет' }] }] };
    expect(parseStoredBody(serializeDoc(doc))).toEqual(doc);
  });

  it('JSON без формы doc (например, чужой объект) считается старой разметкой', () => {
    const result = parseStoredBody('{"foo":1}');
    expect(result.type).toBe('doc');
    expect(docToPlainText(result)).toContain('foo');
  });
});

describe('parseStoredBody: миграция старой разметки', () => {
  it('жирный/курсив/зачёркнутый/выделение переносятся в марки текста', () => {
    const doc = parseStoredBody('**жирный** *курсив* ~~зачёркнутый~~ ==выделено==');
    const para = doc.content[0];
    const marks = (para.content ?? []).map((n) => n.marks?.[0]?.type ?? null);
    expect(marks).toEqual(['bold', null, 'italic', null, 'strike', null, 'highlight']);
  });

  it('ссылка становится марком link с href', () => {
    const doc = parseStoredBody('[текст](https://ecash.kz)');
    const [node] = doc.content[0].content!;
    expect(node.marks).toEqual([{ type: 'link', attrs: { href: 'https://ecash.kz' } }]);
  });

  it('заголовки, списки, цитата, врезка и разделитель — свои типы узлов', () => {
    const doc = parseStoredBody('## Заголовок\n- раз\n- два\n> цитата\n!> врезка\n---');
    const types = doc.content.map((n) => n.type);
    expect(types).toEqual(['heading', 'bulletList', 'blockquote', 'callout', 'horizontalRule']);
    expect(doc.content[0].attrs).toEqual({ level: 2 });
    expect(doc.content[1].content).toHaveLength(2);
    expect(doc.content[1].content![0].type).toBe('listItem');
  });

  it('нумерованный список отличим от маркированного', () => {
    const doc = parseStoredBody('1. раз\n2. два');
    expect(doc.content[0].type).toBe('orderedList');
  });

  it('пустая старая разметка тоже даёт пустой документ', () => {
    expect(parseStoredBody('   ')).toEqual(emptyDoc());
  });
});

describe('docToPlainText / plainTextFromStoredBody', () => {
  it('склеивает текст блоков через пробел, разметку теряет', () => {
    const text = plainTextFromStoredBody('## Заголовок\nОбычный **жирный** текст');
    expect(text).toBe('Заголовок Обычный жирный текст');
  });

  it('обрезает по границе слова и добавляет многоточие', () => {
    const doc: Doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'раз два три четыре пять' }] }],
    };
    expect(docToPlainText(doc, 10)).toBe('раз два…');
  });

  it('пустой документ — пустая строка', () => {
    expect(docToPlainText(emptyDoc())).toBe('');
  });

  it('списки разворачиваются через пробел (старая разметка)', () => {
    expect(plainTextFromStoredBody('- раз\n- два')).toBe('раз два');
  });

  it('разделитель не оставляет лишних пробелов (старая разметка)', () => {
    expect(plainTextFromStoredBody('раз\n---\nдва')).toBe('раз два');
  });

  it('цитата и врезка попадают в выжимку (старая разметка)', () => {
    expect(plainTextFromStoredBody('> цитата\n!> врезка')).toBe('цитата врезка');
  });

  it('маркеры зачёркивания и выделения в выжимку не попадают (старая разметка)', () => {
    expect(plainTextFromStoredBody('~~было~~ ==стало==')).toBe('было стало');
  });
});

describe('docTextLeaves / withTranslatedLeaves', () => {
  it('собирает текст листьев по порядку обхода, не трогая марки', () => {
    const doc = parseStoredBody('## Заголовок\nОбычный **жирный** текст');
    expect(docTextLeaves(doc)).toEqual(['Заголовок', 'Обычный ', 'жирный', ' текст']);
  });

  it('подставляет перевод строго по позициям, структура и марки не меняются', () => {
    const doc = parseStoredBody('Обычный **жирный** текст');
    const leaves = docTextLeaves(doc);
    const translated = withTranslatedLeaves(doc, leaves.map((s) => s.toUpperCase()));
    expect(docTextLeaves(translated)).toEqual(['ОБЫЧНЫЙ ', 'ЖИРНЫЙ', ' ТЕКСТ']);
    // марка сохранилась на своём листе
    const para = translated.content[0].content!;
    expect(para[1]).toEqual({ type: 'text', text: 'ЖИРНЫЙ', marks: [{ type: 'bold' }] });
  });

  it('документ без текста — пустой список листьев', () => {
    expect(docTextLeaves(emptyDoc())).toEqual([]);
  });
});

describe('isBodyEmpty', () => {
  it('пустой JSON-документ с одним абзацем — пусто, хотя строка не пустая', () => {
    const source = serializeDoc(emptyDoc());
    expect(source.trim()).not.toBe(''); // сама строка непустая…
    expect(isBodyEmpty(source)).toBe(true); // …но видимого текста в ней нет
  });

  it('документ с текстом — не пусто', () => {
    expect(isBodyEmpty(serializeDoc(parseStoredBody('текст')))).toBe(false);
  });

  it('пустая строка и старая пустая разметка — тоже пусто', () => {
    expect(isBodyEmpty('')).toBe(true);
    expect(isBodyEmpty('   ')).toBe(true);
  });
});

describe('isSafeColor', () => {
  it('принимает только #rrggbb', () => {
    expect(isSafeColor('#ff6a00')).toBe(true);
    expect(isSafeColor('#FF6A00')).toBe(true);
    expect(isSafeColor('red')).toBe(false);
    expect(isSafeColor('#fff')).toBe(false);
    expect(isSafeColor('javascript:alert(1)')).toBe(false);
    expect(isSafeColor(null)).toBe(false);
  });
});

describe('isSafeFontFamily', () => {
  it('принимает только значения из FONT_STACK', () => {
    for (const key of FONT_KEYS) expect(isSafeFontFamily(FONT_STACK[key])).toBe(true);
    expect(isSafeFontFamily('serif')).toBe(false); // ключ/generic-CSS — не значение из таблицы
    expect(isSafeFontFamily('Comic Sans MS')).toBe(false);
    expect(isSafeFontFamily(42)).toBe(false);
  });
});
