import { describe, expect, it } from 'vitest';
import { isSafeHref, parseInline, parseRichText, richTextToPlain } from './richtext';

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

describe('richTextToPlain', () => {
  it('снимает разметку', () => {
    expect(richTextToPlain('## Заголовок\n**жирный** и *курсив*')).toBe(
      'Заголовок жирный и курсив',
    );
  });

  it('разворачивает списки', () => {
    expect(richTextToPlain('- раз\n- два')).toBe('раз два');
  });

  it('обрезает по границе слова с многоточием', () => {
    const out = richTextToPlain('Довольно длинное предложение для проверки обрезки', 20);
    expect(out.length).toBeLessThanOrEqual(21);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toContain('  ');
  });

  it('короткий текст не трогает', () => {
    expect(richTextToPlain('Коротко', 100)).toBe('Коротко');
  });
});
