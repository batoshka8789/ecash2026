import { describe, expect, it } from 'vitest';
import { isSafeHref, parseInline, parseRichText } from './richtext';

/** Компактная запись дерева — сравнивать структуры целиком нечитаемо. */
const brief = (src: string): string =>
  parseInline(src)
    .map(function walk(n): string {
      if (n.type === 'text') return n.value;
      if (n.type === 'link') return `a(${n.href}){${n.children.map(walk).join('')}}`;
      return `${n.type === 'bold' ? 'b' : 'i'}{${n.children.map(walk).join('')}}`;
    })
    .join('');

describe('parseRichText: блоки', () => {
  it('строка = абзац, пустые строки только разделяют', () => {
    const blocks = parseRichText('Первый\n\n\nВторой');
    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => b.type === 'paragraph')).toBe(true);
  });

  it('## даёт h2, ### и глубже — h3', () => {
    const [h2, h3, h4] = parseRichText('## Два\n### Три\n#### Четыре');
    expect(h2).toMatchObject({ type: 'heading', level: 2 });
    expect(h3).toMatchObject({ type: 'heading', level: 3 });
    // заголовок новости — отдельное поле, поэтому внутри текста потолок h2
    expect(h4).toMatchObject({ type: 'heading', level: 3 });
  });

  it('одиночная решётка — тоже h2, а не ошибка', () => {
    expect(parseRichText('# Заголовок')[0]).toMatchObject({ type: 'heading', level: 2 });
  });

  it('подряд идущие пункты собираются в один список', () => {
    const blocks = parseRichText('- раз\n- два\n- три');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'list', ordered: false });
    expect(blocks[0].type === 'list' && blocks[0].items).toHaveLength(3);
  });

  it('нумерованный и маркированный — разные блоки', () => {
    const blocks = parseRichText('- раз\n1. два');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ ordered: false });
    expect(blocks[1]).toMatchObject({ ordered: true });
  });

  it('пустой ввод не роняет и даёт пустой список блоков', () => {
    expect(parseRichText('')).toEqual([]);
    expect(parseRichText('   \n  \n')).toEqual([]);
  });
});

describe('parseInline: форматирование', () => {
  it('жирный и курсив', () => {
    expect(brief('**жирный**')).toBe('b{жирный}');
    expect(brief('*курсив*')).toBe('i{курсив}');
  });

  it('вложенность жирного и курсива', () => {
    expect(brief('**жирный *и курсив***')).toBe('b{жирный i{и курсив}}');
  });

  it('незакрытый маркер остаётся обычным текстом — превью не должно падать на полуслове', () => {
    expect(brief('**недописанный')).toBe('**недописанный');
    expect(brief('*')).toBe('*');
    expect(brief('[текст](')).toBe('[текст](');
  });

  it('умножение не превращается в курсив', () => {
    expect(brief('2 * 3 * 4')).toBe('2 * 3 * 4');
  });

  it('пустая обёртка не создаёт узел', () => {
    expect(brief('****')).toBe('****');
  });

  it('экранирование звёздочки', () => {
    expect(brief('\\*не курсив\\*')).toBe('*не курсив*');
  });
});

describe('ссылки и безопасность', () => {
  it('обычная ссылка разбирается', () => {
    expect(brief('[сайт](https://ecash.kz)')).toBe('a(https://ecash.kz){сайт}');
  });

  it('внутренний путь разрешён', () => {
    expect(brief('[курсы](/locations)')).toBe('a(/locations){курсы}');
  });

  it('javascript: ссылкой не становится', () => {
    expect(isSafeHref('javascript:alert(1)')).toBe(false);
    expect(brief('[клик](javascript:alert(1))')).toBe('[клик](javascript:alert(1))');
  });

  it('data: и протокол-относительные ссылки отклоняются', () => {
    expect(isSafeHref('data:text/html,<script>')).toBe(false);
    expect(isSafeHref('//evil.example')).toBe(false);
  });

  it('регистр схемы не обходит проверку', () => {
    expect(isSafeHref('JavaScript:alert(1)')).toBe(false);
    expect(isSafeHref('HTTPS://ecash.kz')).toBe(true);
  });
});

describe('parseRichText — цитаты, врезки, разделитель', () => {
  it('цитата', () => {
    expect(parseRichText('> Слова клиента')).toEqual([
      { type: 'quote', children: [{ type: 'text', value: 'Слова клиента' }] },
    ]);
  });

  it('врезка не считается цитатой: «!>» проверяется раньше', () => {
    expect(parseRichText('!> Важно')).toEqual([
      { type: 'callout', children: [{ type: 'text', value: 'Важно' }] },
    ]);
  });

  it('разделитель из трёх и более символов', () => {
    expect(parseRichText('---')).toEqual([{ type: 'divider' }]);
    expect(parseRichText('*****')).toEqual([{ type: 'divider' }]);
  });

  it('два дефиса разделителем не становятся', () => {
    expect(parseRichText('--')[0].type).toBe('paragraph');
  });

  it('разметка внутри цитаты разбирается', () => {
    const [block] = parseRichText('> **важно**');
    expect(block).toEqual({
      type: 'quote',
      children: [{ type: 'bold', children: [{ type: 'text', value: 'важно' }] }],
    });
  });
});

describe('parseInline — выделение и зачёркивание', () => {
  it('цветное выделение', () => {
    expect(parseInline('==акцент==')).toEqual([
      { type: 'mark', children: [{ type: 'text', value: 'акцент' }] },
    ]);
  });

  it('зачёркнутый', () => {
    expect(parseInline('~~старая цена~~')).toEqual([
      { type: 'strike', children: [{ type: 'text', value: 'старая цена' }] },
    ]);
  });

  it('незакрытый маркер остаётся текстом', () => {
    expect(parseInline('==висит')).toEqual([{ type: 'text', value: '==висит' }]);
  });

  it('одиночный знак равенства не разметка', () => {
    expect(parseInline('2 = 2')).toEqual([{ type: 'text', value: '2 = 2' }]);
  });

  it('вложение внутрь выделения работает', () => {
    expect(parseInline('==**оба**==')).toEqual([
      {
        type: 'mark',
        children: [{ type: 'bold', children: [{ type: 'text', value: 'оба' }] }],
      },
    ]);
  });

  it('экранирование снимает разметку', () => {
    expect(parseInline('\\==не акцент==')).toEqual([{ type: 'text', value: '==не акцент==' }]);
  });
});


